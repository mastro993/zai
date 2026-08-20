use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use super::import_models::{
    BoundImportPreview, CommitTransactionImportRequest, CommitTransactionImportResponse,
    PreviewTransactionImportRequest,
};
use super::import_preview::{
    ClassifiedImport, CurrencyPrepContext, binding_for, classify_import,
    currencies_needing_provider, currencies_to_enable, currency_preparations,
    duplicate_candidates_from_request,
};
use super::models::NewTransaction;
use super::traits::TransactionsRepositoryTrait;
use crate::features::currency::{
    CurrencyJob, CurrencyJobStatus, CurrencyJobType, CurrencyService, CurrencySettingsPort,
};
use crate::features::transaction_categories::service::normalize_import_categories;
use crate::{Error, Result};
use uuid::Uuid;

#[derive(Clone)]
struct StoredBoundPreview {
    binding: super::import_models::ImportPreviewBinding,
    classified: ClassifiedImport,
    preparations: Vec<super::import_models::CurrencyPreparation>,
}

pub struct TransactionImportService {
    currency: Arc<CurrencyService>,
    settings: Arc<dyn CurrencySettingsPort>,
    repository: Arc<dyn TransactionsRepositoryTrait>,
    store: Mutex<HashMap<String, StoredBoundPreview>>,
}

impl TransactionImportService {
    pub fn new(
        currency: Arc<CurrencyService>,
        settings: Arc<dyn CurrencySettingsPort>,
        repository: Arc<dyn TransactionsRepositoryTrait>,
    ) -> Self {
        Self {
            currency,
            settings,
            repository,
            store: Mutex::new(HashMap::new()),
        }
    }

    pub async fn preview(
        &self,
        request: PreviewTransactionImportRequest,
    ) -> Result<BoundImportPreview> {
        self.settings.require_setup()?;
        self.prune_terminal_previews();
        let candidates = duplicate_candidates_from_request(&request);
        let existing = self
            .repository
            .find_existing_duplicate_keys(candidates)
            .await
            .inspect_err(|error| diagnose_preview_error("find duplicates", error))?;
        let existing_set = existing.into_iter().collect::<HashSet<_>>();
        let mut classified = classify_import(&request, &existing_set)?;
        let persisted = self
            .settings
            .list_persisted()
            .inspect_err(|error| diagnose_preview_error("list currencies", error))?;
        let default_currency = self
            .settings
            .setup_state()
            .inspect_err(|error| diagnose_preview_error("read setup", error))?
            .default_currency;
        let preparations = currency_preparations(
            &classified.currencies,
            CurrencyPrepContext {
                persisted: &persisted,
                default_currency: &default_currency,
            },
        );
        classified.commit.enable_currencies = currencies_to_enable(&preparations);
        let provider_codes = currencies_needing_provider(&preparations);
        if !provider_codes.is_empty()
            && !self.settings.provider_disclosure_accepted()?
            && !request.confirm_provider_disclosure
        {
            return Err(Error::ProviderDisclosureRequired);
        }
        if request.confirm_provider_disclosure && !provider_codes.is_empty() {
            self.settings.accept_provider_disclosure()?;
        }

        let revision = self
            .settings
            .default_currency_revision()
            .inspect_err(|error| diagnose_preview_error("read default revision", error))?;
        let coverage = self
            .settings
            .coverage_proof_digest()
            .inspect_err(|error| diagnose_preview_error("read coverage", error))?;
        let binding = binding_for(&request.file_digest, revision, &coverage);
        let job = self
            .currency
            .start_import_preview_job()
            .inspect_err(|error| diagnose_preview_error("start job", error))?;
        let token = job.job_id.clone();
        self.lock_store().insert(
            token.clone(),
            StoredBoundPreview {
                binding: binding.clone(),
                classified: classified.clone(),
                preparations: preparations.clone(),
            },
        );

        let job = if provider_codes.is_empty() {
            match self
                .drive_running_preview()
                .inspect_err(|error| diagnose_preview_error("drive job", error))
            {
                Ok(job) => job,
                Err(error) => {
                    self.lock_store().remove(&token);
                    return Err(error);
                }
            }
        } else {
            job
        };

        Ok(self.bound_preview(
            token,
            job,
            &StoredBoundPreview {
                binding,
                classified,
                preparations,
            },
        ))
    }

    pub fn get_preview(&self, token: &str) -> Result<BoundImportPreview> {
        self.settings.require_setup()?;
        self.prune_terminal_previews();
        let stored = self
            .lock_store()
            .get(token)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("Import preview {token}")))?;
        let job = self.currency.get_job(token)?;
        Ok(self.bound_preview(token.to_string(), job, &stored))
    }

    pub fn drive_running_preview(&self) -> Result<CurrencyJob> {
        let Some(record) = self.settings.running_job()? else {
            return Err(Error::CurrencyJobNotFound("running".to_string()));
        };
        if record.job.job_type != CurrencyJobType::ImportPreview {
            return Err(Error::InvalidData(
                "Running job is not an import preview".to_string(),
            ));
        }
        let mut job = record.job;
        job.stage_current = 1;
        self.settings.update_job(&job)?;
        self.currency
            .publish(&crate::features::currency::CurrencyStateEvent::Progress {
                job_id: job.job_id.clone(),
                job_type: CurrencyJobType::ImportPreview,
                stage_current: job.stage_current,
                stage_total: job.stage_total,
            });
        let stored = self
            .lock_store()
            .get(&job.job_id)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("Import preview {}", job.job_id)))?;
        for code in currencies_needing_provider(&stored.preparations) {
            if let Err(error) = self.settings.prove_coverage(&code) {
                let job_id = job.job_id.clone();
                let result = self.currency.fail_job(job, error);
                self.lock_store().remove(&job_id);
                return result;
            }
        }
        self.currency.mark_job_succeeded(job)
    }

    pub async fn commit(
        &self,
        request: CommitTransactionImportRequest,
    ) -> Result<CommitTransactionImportResponse> {
        self.settings.require_setup()?;
        self.prune_terminal_previews();
        let stored = self
            .lock_store()
            .get(&request.token)
            .cloned()
            .ok_or_else(|| Error::NotFound(format!("Import preview {}", request.token)))?;
        let job = self.currency.get_job(&request.token)?;
        if job.status != CurrencyJobStatus::Succeeded {
            return Err(Error::InvalidData(
                "Import preview is not complete".to_string(),
            ));
        }
        if request.file_digest != stored.binding.file_digest {
            return Err(Error::StaleImportPreview);
        }
        let current = binding_for(
            &request.file_digest,
            self.settings.default_currency_revision()?,
            &self.settings.coverage_proof_digest()?,
        );
        if !stored.binding.matches(&current) {
            return Err(Error::StaleImportPreview);
        }
        if stored.classified.summary.blocked {
            return Err(Error::InvalidData(
                "Import contains invalid rows".to_string(),
            ));
        }

        let mut commit = stored.classified.commit;
        commit.categories = normalize_import_categories(commit.categories)?;
        for category in &mut commit.categories {
            if category.id.as_deref().is_none_or(|id| id.trim().is_empty()) {
                category.id = Some(Uuid::new_v4().to_string());
            }
        }
        for row in &mut commit.rows {
            ensure_transaction_id(&mut row.transaction);
        }

        let transactions = self.repository.commit_bound_import(commit).await?;
        self.lock_store().remove(&request.token);
        Ok(CommitTransactionImportResponse { transactions })
    }

    fn bound_preview(
        &self,
        token: String,
        job: CurrencyJob,
        stored: &StoredBoundPreview,
    ) -> BoundImportPreview {
        BoundImportPreview {
            token,
            job,
            binding: stored.binding.clone(),
            rows: stored.classified.rows.clone(),
            currency_preparations: stored.preparations.clone(),
            summary: stored.classified.summary.clone(),
        }
    }

    fn lock_store(&self) -> std::sync::MutexGuard<'_, HashMap<String, StoredBoundPreview>> {
        self.store
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn prune_terminal_previews(&self) {
        let tokens = self.lock_store().keys().cloned().collect::<Vec<_>>();
        for token in tokens {
            let should_remove = match self.currency.get_job(&token) {
                Ok(job) => matches!(
                    job.status,
                    CurrencyJobStatus::Failed | CurrencyJobStatus::Cancelled
                ),
                Err(Error::CurrencyJobNotFound(_)) => true,
                Err(_) => false,
            };
            if should_remove {
                self.lock_store().remove(&token);
            }
        }
    }
}

fn diagnose_preview_error(stage: &str, error: &Error) {
    if std::env::var_os("ZAI_E2E_DIAGNOSTICS").is_some() {
        eprintln!("[DEBUG-import-preview-stage] {stage}: {error:?}");
    }
}

fn ensure_transaction_id(transaction: &mut NewTransaction) {
    if transaction
        .id
        .as_deref()
        .is_none_or(|id| id.trim().is_empty() || id.starts_with("imp-"))
    {
        transaction.id = Some(Uuid::new_v4().to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::currency::{
        CurrencyJobRecord, CurrencyRefreshStatus, CurrencySetupState, CurrencyStateEventBus,
        ExchangeRateQuote, PersistedCurrency, QuoteVariant, needs_provider,
    };
    use crate::features::transactions::import_models::MappedImportRow;
    use crate::features::transactions::models::{
        DuplicateKeyCandidate, Transaction, TransactionListItem, TransactionSearchFilters,
        TransactionUpdate,
    };
    use crate::query::{PaginatedData, Sort};
    use chrono::NaiveDateTime;

    #[derive(Default)]
    struct MemorySettings {
        setup_completed: bool,
        default_currency: String,
        revision: i32,
        coverage: String,
        disclosure_accepted: bool,
        jobs: Vec<CurrencyJob>,
        persisted: Vec<PersistedCurrency>,
    }

    impl MemorySettings {
        fn ready() -> Self {
            Self {
                setup_completed: true,
                default_currency: "EUR".to_string(),
                revision: 1,
                coverage: "none".to_string(),
                disclosure_accepted: false,
                jobs: Vec::new(),
                persisted: vec![PersistedCurrency {
                    code: "EUR".to_string(),
                    disabled: false,
                    used_by_recurring: false,
                    coverage_from: None,
                    coverage_to: None,
                    last_refresh: None,
                    refresh_status: CurrencyRefreshStatus::Idle,
                    missing_periods: Vec::new(),
                }],
            }
        }
    }

    impl CurrencySettingsPort for Mutex<MemorySettings> {
        fn complete_initial_setup(&self, _currency_code: &str) -> Result<()> {
            Ok(())
        }
        fn setup_state(&self) -> Result<CurrencySetupState> {
            let inner = self.lock().expect("lock");
            Ok(CurrencySetupState {
                default_currency: inner.default_currency.clone(),
                setup_completed: inner.setup_completed,
            })
        }
        fn require_setup(&self) -> Result<()> {
            if self.lock().expect("lock").setup_completed {
                Ok(())
            } else {
                Err(Error::SetupRequired)
            }
        }
        fn list_persisted(&self) -> Result<Vec<PersistedCurrency>> {
            Ok(self.lock().expect("lock").persisted.clone())
        }
        fn insert_job(&self, job: &CurrencyJob) -> Result<()> {
            let mut inner = self.lock().expect("lock");
            if inner
                .jobs
                .iter()
                .any(|existing| existing.status == CurrencyJobStatus::Running)
            {
                return Err(Error::CurrencyJobConflict);
            }
            inner.jobs.push(job.clone());
            Ok(())
        }
        fn update_job(&self, job: &CurrencyJob) -> Result<()> {
            let mut inner = self.lock().expect("lock");
            if let Some(existing) = inner
                .jobs
                .iter_mut()
                .find(|existing| existing.job_id == job.job_id)
            {
                *existing = job.clone();
            }
            Ok(())
        }
        fn get_job(&self, job_id: &str) -> Result<Option<CurrencyJobRecord>> {
            Ok(self
                .lock()
                .expect("lock")
                .jobs
                .iter()
                .find(|job| job.job_id == job_id)
                .cloned()
                .map(|job| CurrencyJobRecord {
                    job,
                    generation_id: None,
                }))
        }
        fn running_job(&self) -> Result<Option<CurrencyJobRecord>> {
            Ok(self
                .lock()
                .expect("lock")
                .jobs
                .iter()
                .find(|job| job.status == CurrencyJobStatus::Running)
                .cloned()
                .map(|job| CurrencyJobRecord {
                    job,
                    generation_id: None,
                }))
        }
        fn latest_job(&self) -> Result<Option<CurrencyJobRecord>> {
            Ok(self
                .lock()
                .expect("lock")
                .jobs
                .last()
                .cloned()
                .map(|job| CurrencyJobRecord {
                    job,
                    generation_id: None,
                }))
        }
        fn enable_currency(&self, _currency_code: &str) -> Result<()> {
            Ok(())
        }
        fn disable_currency(&self, _currency_code: &str) -> Result<()> {
            Ok(())
        }
        fn prove_coverage(&self, _currency_code: &str) -> Result<()> {
            Ok(())
        }
        fn provider_disclosure_accepted(&self) -> Result<bool> {
            Ok(self.lock().expect("lock").disclosure_accepted)
        }
        fn accept_provider_disclosure(&self) -> Result<()> {
            self.lock().expect("lock").disclosure_accepted = true;
            Ok(())
        }
        fn has_ecb_retained_data(&self) -> Result<bool> {
            Ok(false)
        }
        fn begin_default_generation(&self, _currency_code: &str) -> Result<String> {
            Ok("gen".to_string())
        }
        fn activate_default_generation(
            &self,
            _generation_id: &str,
            _currency_code: &str,
        ) -> Result<()> {
            Ok(())
        }
        fn attach_generation(&self, _job_id: &str, _generation_id: &str) -> Result<()> {
            Ok(())
        }
        fn quote(&self, source: &str, target: &str, rate_date: &str) -> Result<ExchangeRateQuote> {
            Ok(ExchangeRateQuote {
                source_currency: source.to_string(),
                target_currency: target.to_string(),
                rate_date: rate_date.to_string(),
                variant: QuoteVariant::Identity,
                rate: Some("1".to_string()),
                attribution: None,
                complete: true,
            })
        }
        fn default_currency_revision(&self) -> Result<i32> {
            Ok(self.lock().expect("lock").revision)
        }
        fn coverage_proof_digest(&self) -> Result<String> {
            Ok(self.lock().expect("lock").coverage.clone())
        }
    }

    #[derive(Default)]
    struct FakeRepository {
        committed: Mutex<usize>,
    }

    #[async_trait::async_trait]
    impl TransactionsRepositoryTrait for FakeRepository {
        async fn get_transactions(
            &self,
            _page: i64,
            _per_page: i64,
            _filters: Option<TransactionSearchFilters<'_>>,
            _sort: Option<Sort>,
        ) -> Result<PaginatedData<TransactionListItem>> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn get_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn get_filtered_transaction_ids(
            &self,
            _filters: Option<TransactionSearchFilters<'_>>,
            _sort: Option<Sort>,
        ) -> Result<Vec<String>> {
            Ok(Vec::new())
        }
        async fn export_transactions_csv(
            &self,
            _filters: Option<TransactionSearchFilters<'_>>,
            _transaction_ids: Option<Vec<String>>,
        ) -> Result<String> {
            Ok(String::new())
        }
        async fn find_existing_duplicate_keys(
            &self,
            _candidates: Vec<DuplicateKeyCandidate>,
        ) -> Result<Vec<String>> {
            Ok(Vec::new())
        }
        async fn create_transaction(
            &self,
            _new_transaction: NewTransaction,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn update_transaction(
            &self,
            _updated_transaction: TransactionUpdate,
        ) -> Result<Transaction> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn delete_transaction(&self, _id: &str) -> Result<Transaction> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn delete_transactions(&self, _ids: Vec<&str>) -> Result<Vec<TransactionListItem>> {
            Err(Error::InvalidData("unused".to_string()))
        }
        async fn import_transactions(
            &self,
            _transactions: Vec<NewTransaction>,
        ) -> Result<Vec<Transaction>> {
            Ok(Vec::new())
        }
        async fn import_transactions_with_categories(
            &self,
            _categories: Vec<
                crate::features::transaction_categories::models::NewTransactionCategory,
            >,
            _transactions: Vec<NewTransaction>,
        ) -> Result<(
            Vec<crate::features::transaction_categories::models::TransactionCategory>,
            Vec<Transaction>,
        )> {
            Ok((Vec::new(), Vec::new()))
        }
        async fn commit_bound_import(
            &self,
            request: crate::features::transactions::import_models::BoundImportCommitRequest,
        ) -> Result<Vec<Transaction>> {
            *self.committed.lock().expect("lock") += request.rows.len();
            Ok(Vec::new())
        }
    }

    fn mapped_row() -> MappedImportRow {
        MappedImportRow {
            row_number: 2,
            empty: false,
            date: Some("2026-01-15T08:30:00".to_string()),
            amount_minor: Some(1250),
            currency: Some("EUR".to_string()),
            transaction_type: Some("expense".to_string()),
            description: Some("Groceries".to_string()),
            notes: None,
            parent_category: None,
            category: None,
            mapped_rate: None,
            native: None,
        }
    }

    fn service() -> (
        TransactionImportService,
        Arc<Mutex<MemorySettings>>,
        Arc<FakeRepository>,
    ) {
        let settings = Arc::new(Mutex::new(MemorySettings::ready()));
        let bus = CurrencyStateEventBus::new();
        let currency = Arc::new(CurrencyService::new(settings.clone(), bus));
        let repository = Arc::new(FakeRepository::default());
        (
            TransactionImportService::new(currency, settings.clone(), repository.clone()),
            settings,
            repository,
        )
    }

    #[tokio::test]
    async fn eur_preview_completes_synchronously() {
        let (service, _, _) = service();
        let preview = service
            .preview(PreviewTransactionImportRequest {
                file_digest: "abc".to_string(),
                has_currency_column: true,
                confirmed_transaction_currency: None,
                confirm_provider_disclosure: false,
                rows: vec![mapped_row()],
            })
            .await
            .expect("preview");
        assert_eq!(preview.job.status, CurrencyJobStatus::Succeeded);
        assert_eq!(preview.summary.importable_rows, 1);
        assert!(!preview.summary.blocked);
    }

    #[tokio::test]
    async fn commit_rejects_stale_default_revision() {
        let (service, settings, _) = service();
        let preview = service
            .preview(PreviewTransactionImportRequest {
                file_digest: "abc".to_string(),
                has_currency_column: true,
                confirmed_transaction_currency: None,
                confirm_provider_disclosure: false,
                rows: vec![mapped_row()],
            })
            .await
            .expect("preview");
        settings.lock().expect("lock").revision = 2;
        let error = service
            .commit(CommitTransactionImportRequest {
                token: preview.token,
                file_digest: "abc".to_string(),
            })
            .await
            .expect_err("stale");
        assert!(matches!(error, Error::StaleImportPreview));
    }

    #[tokio::test]
    async fn commit_rejects_invalid_rows() {
        let (service, _, _) = service();
        let mut invalid = mapped_row();
        invalid.currency = None;
        let preview = service
            .preview(PreviewTransactionImportRequest {
                file_digest: "abc".to_string(),
                has_currency_column: true,
                confirmed_transaction_currency: None,
                confirm_provider_disclosure: false,
                rows: vec![invalid],
            })
            .await
            .expect("preview");
        assert!(preview.summary.blocked);
        let error = service
            .commit(CommitTransactionImportRequest {
                token: preview.token,
                file_digest: "abc".to_string(),
            })
            .await
            .expect_err("blocked");
        assert!(matches!(error, Error::InvalidData(message) if message.contains("invalid rows")));
    }

    #[tokio::test]
    async fn prune_removes_failed_preview_store_entries() {
        let (service, settings, _) = service();
        settings.lock().expect("lock").disclosure_accepted = true;
        let mut foreign = mapped_row();
        foreign.currency = Some("USD".to_string());
        let preview = service
            .preview(PreviewTransactionImportRequest {
                file_digest: "abc".to_string(),
                has_currency_column: true,
                confirmed_transaction_currency: None,
                confirm_provider_disclosure: true,
                rows: vec![foreign],
            })
            .await
            .expect("preview");
        assert_eq!(preview.job.status, CurrencyJobStatus::Running);

        {
            let mut inner = settings.lock().expect("lock");
            if let Some(job) = inner
                .jobs
                .iter_mut()
                .find(|job| job.job_id == preview.token)
            {
                job.status = CurrencyJobStatus::Failed;
            }
        }

        let error = service
            .get_preview(&preview.token)
            .expect_err("failed preview pruned");
        assert!(matches!(error, Error::NotFound(_)));
    }

    #[tokio::test]
    async fn cancelled_preview_cannot_commit() {
        let (service, settings, repository) = service();
        settings.lock().expect("lock").disclosure_accepted = true;
        let mut foreign = mapped_row();
        foreign.currency = Some("USD".to_string());
        let preview = service
            .preview(PreviewTransactionImportRequest {
                file_digest: "abc".to_string(),
                has_currency_column: true,
                confirmed_transaction_currency: None,
                confirm_provider_disclosure: true,
                rows: vec![foreign],
            })
            .await
            .expect("preview");
        assert_eq!(preview.job.status, CurrencyJobStatus::Running);

        {
            let mut inner = settings.lock().expect("lock");
            if let Some(job) = inner
                .jobs
                .iter_mut()
                .find(|job| job.job_id == preview.token)
            {
                job.status = CurrencyJobStatus::Cancelled;
            }
        }

        let error = service
            .commit(CommitTransactionImportRequest {
                token: preview.token,
                file_digest: "abc".to_string(),
            })
            .await
            .expect_err("cancelled preview cannot commit");
        assert!(matches!(error, Error::NotFound(_)));
        assert_eq!(*repository.committed.lock().expect("lock"), 0);
    }

    #[test]
    fn placeholder_import_ids_are_replaced() {
        let mut transaction = NewTransaction {
            id: Some("imp-2".to_string()),
            description: Some("Groceries".to_string()),
            amount: 1250,
            currency: "EUR".to_string(),
            transaction_date: NaiveDateTime::parse_from_str(
                "2026-01-15 08:30:00",
                "%Y-%m-%d %H:%M:%S",
            )
            .expect("date"),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            manual_exchange_rate: None,
        };
        ensure_transaction_id(&mut transaction);
        let id = transaction.id.expect("id");
        assert!(!id.starts_with("imp-"));
        assert!(!id.is_empty());
    }

    #[test]
    fn needs_provider_skips_eur() {
        assert!(!needs_provider("EUR"));
        assert!(needs_provider("USD"));
    }
}
