use crate::connection::DbConnection;
use diesel::prelude::*;
use diesel::query_builder::*;
use diesel::query_dsl::methods::LoadQuery;
use diesel::sql_types::BigInt;
use diesel::sqlite::Sqlite;
use zai_core::Error;

pub trait Paginate: Sized {
    fn paginate(self, page: i64) -> Result<Paginated<Self>, Error>;
}

impl<T> Paginate for T {
    fn paginate(self, page: i64) -> Result<Paginated<Self>, Error> {
        Ok(Paginated {
            query: self,
            per_page: DEFAULT_PER_PAGE,
            page,
            offset: compute_offset(page, DEFAULT_PER_PAGE)?,
        })
    }
}

const DEFAULT_PER_PAGE: i64 = 50;

#[derive(Debug, Clone, Copy, QueryId)]
pub struct Paginated<T> {
    query: T,
    page: i64,
    per_page: i64,
    offset: i64,
}

impl<T> Paginated<T> {
    pub fn per_page(self, per_page: i64) -> Result<Self, Error> {
        Ok(Paginated {
            per_page,
            offset: compute_offset(self.page, per_page)?,
            ..self
        })
    }

    pub fn load_page<'a, U>(self, conn: &mut DbConnection) -> QueryResult<Vec<U>>
    where
        Self: LoadQuery<'a, DbConnection, U>,
    {
        self.load(conn)
    }
}

pub fn compute_offset(page: i64, per_page: i64) -> Result<i64, Error> {
    if page < 1 || per_page < 1 {
        return Err(Error::InvalidData(
            "Pagination page and page size must be at least 1".to_string(),
        ));
    }

    page.checked_sub(1)
        .and_then(|value| value.checked_mul(per_page))
        .ok_or_else(|| Error::InvalidData("Pagination page offset overflow".to_string()))
}

pub fn total_pages(total: i64, per_page: i64) -> i64 {
    (total as f64 / per_page as f64).ceil() as i64
}

impl<T: Query> Query for Paginated<T> {
    type SqlType = T::SqlType;
}

impl<T> RunQueryDsl<DbConnection> for Paginated<T> {}

impl<T> QueryFragment<Sqlite> for Paginated<T>
where
    T: QueryFragment<Sqlite>,
{
    fn walk_ast<'b>(&'b self, mut out: AstPass<'_, 'b, Sqlite>) -> QueryResult<()> {
        out.push_sql("SELECT * FROM (");
        self.query.walk_ast(out.reborrow())?;
        out.push_sql(") t LIMIT ");
        out.push_bind_param::<BigInt, _>(&self.per_page)?;
        out.push_sql(" OFFSET ");
        out.push_bind_param::<BigInt, _>(&self.offset)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::transactions;
    use diesel::QueryDsl;

    #[test]
    fn paginated_query_does_not_use_window_count() {
        let query = transactions::table
            .filter(transactions::deleted_at.is_null())
            .select(transactions::all_columns)
            .paginate(2)
            .expect("valid page")
            .per_page(10)
            .expect("valid page size");

        let sql = diesel::debug_query::<Sqlite, _>(&query).to_string();
        assert!(
            !sql.contains("COUNT(*) OVER ()"),
            "paginated query must not use window count: {sql}"
        );
    }

    #[test]
    fn total_pages_rounds_up() {
        assert_eq!(total_pages(0, 10), 0);
        assert_eq!(total_pages(1, 10), 1);
        assert_eq!(total_pages(10, 10), 1);
        assert_eq!(total_pages(11, 10), 2);
    }

    #[test]
    fn compute_offset_rejects_invalid_values() {
        assert!(compute_offset(0, 10).is_err());
        assert!(compute_offset(1, 0).is_err());
        assert!(compute_offset(-1, 10).is_err());
        assert!(compute_offset(1, -5).is_err());
    }

    #[test]
    fn compute_offset_rejects_overflow() {
        assert!(compute_offset(i64::MAX, 2).is_err());
    }
}
