use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::{BudgetImpact, Error};

const INVALID_COLOR_MESSAGE: &str =
    "Category color must be a valid hex color in the format #RRGGBB";

fn validate_color(color: Option<&str>) -> Result<(), Error> {
    if let Some(color) = color {
        let is_valid_hex = color.len() == 7
            && color.starts_with('#')
            && color.as_bytes()[1..]
                .iter()
                .all(|byte| byte.is_ascii_hexdigit());

        if !is_valid_hex {
            return Err(Error::InvalidData(INVALID_COLOR_MESSAGE.to_string()));
        }
    }

    Ok(())
}

pub(crate) fn normalize_hex_color(color: &str) -> Result<String, Error> {
    validate_color(Some(color))?;
    Ok(color.to_ascii_uppercase())
}

pub(crate) fn normalize_optional_color(color: Option<&str>) -> Result<Option<String>, Error> {
    color.map(normalize_hex_color).transpose()
}

pub(crate) fn normalize_category_name(name: &str) -> String {
    name.trim().to_string()
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryRole {
    #[default]
    Spending,
    Income,
}

impl CategoryRole {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Spending => "spending",
            Self::Income => "income",
        }
    }
}

impl fmt::Display for CategoryRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for CategoryRole {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "spending" => Ok(Self::Spending),
            "income" => Ok(Self::Income),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryIcon {
    #[default]
    Default,
    Food,
    Groceries,
    Dining,
    Coffee,
    Drinks,
    Bakery,
    Delivery,
    Pizza,
    Snacks,
    Alcohol,
    Home,
    Rent,
    Utilities,
    Phone,
    Internet,
    Shopping,
    Clothing,
    Health,
    Pharmacy,
    Fitness,
    Beauty,
    Education,
    Books,
    Entertainment,
    Gaming,
    Music,
    Movies,
    Subscriptions,
    Laundry,
    Electronics,
    Furniture,
    Sports,
    Hobbies,
    Transport,
    Car,
    Fuel,
    Parking,
    Bicycle,
    Train,
    Flight,
    Hotel,
    Travel,
    Taxi,
    Boat,
    Scooter,
    Taxes,
    Insurance,
    Savings,
    Investments,
    Salary,
    Business,
    Transfer,
    Cash,
    Credit,
    Bills,
    Work,
    Friends,
    Other,
    Gifts,
    Charity,
    Family,
    Childcare,
    Pets,
    Repairs,
    Garden,
    Cleaning,
    Packages,
    Outdoors,
    Beach,
    Party,
    Photos,
    Hospital,
    Vision,
    Kids,
    Bank,
    Legal,
    Fees,
    Haircut,
    Shipping,
    Icecream,
    Fruit,
    Software,
    Jewelry,
    Cloud,
    Print,
    Tools,
    Security,
    Supplies,
    Doctor,
    Firstaid,
    Therapy,
    Yoga,
    Wellness,
    Camping,
    Concert,
}

impl CategoryIcon {
    pub const ALL: [Self; 96] = [
        Self::Default,
        Self::Food,
        Self::Groceries,
        Self::Dining,
        Self::Coffee,
        Self::Drinks,
        Self::Bakery,
        Self::Delivery,
        Self::Pizza,
        Self::Snacks,
        Self::Alcohol,
        Self::Home,
        Self::Rent,
        Self::Utilities,
        Self::Phone,
        Self::Internet,
        Self::Shopping,
        Self::Clothing,
        Self::Health,
        Self::Pharmacy,
        Self::Fitness,
        Self::Beauty,
        Self::Education,
        Self::Books,
        Self::Entertainment,
        Self::Gaming,
        Self::Music,
        Self::Movies,
        Self::Subscriptions,
        Self::Laundry,
        Self::Electronics,
        Self::Furniture,
        Self::Sports,
        Self::Hobbies,
        Self::Transport,
        Self::Car,
        Self::Fuel,
        Self::Parking,
        Self::Bicycle,
        Self::Train,
        Self::Flight,
        Self::Hotel,
        Self::Travel,
        Self::Taxi,
        Self::Boat,
        Self::Scooter,
        Self::Taxes,
        Self::Insurance,
        Self::Savings,
        Self::Investments,
        Self::Salary,
        Self::Business,
        Self::Transfer,
        Self::Cash,
        Self::Credit,
        Self::Bills,
        Self::Work,
        Self::Friends,
        Self::Other,
        Self::Gifts,
        Self::Charity,
        Self::Family,
        Self::Childcare,
        Self::Pets,
        Self::Repairs,
        Self::Garden,
        Self::Cleaning,
        Self::Packages,
        Self::Outdoors,
        Self::Beach,
        Self::Party,
        Self::Photos,
        Self::Hospital,
        Self::Vision,
        Self::Kids,
        Self::Bank,
        Self::Legal,
        Self::Fees,
        Self::Haircut,
        Self::Shipping,
        Self::Icecream,
        Self::Fruit,
        Self::Software,
        Self::Jewelry,
        Self::Cloud,
        Self::Print,
        Self::Tools,
        Self::Security,
        Self::Supplies,
        Self::Doctor,
        Self::Firstaid,
        Self::Therapy,
        Self::Yoga,
        Self::Wellness,
        Self::Camping,
        Self::Concert,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Default => "default",
            Self::Food => "food",
            Self::Groceries => "groceries",
            Self::Dining => "dining",
            Self::Coffee => "coffee",
            Self::Drinks => "drinks",
            Self::Bakery => "bakery",
            Self::Delivery => "delivery",
            Self::Pizza => "pizza",
            Self::Snacks => "snacks",
            Self::Alcohol => "alcohol",
            Self::Home => "home",
            Self::Rent => "rent",
            Self::Utilities => "utilities",
            Self::Phone => "phone",
            Self::Internet => "internet",
            Self::Shopping => "shopping",
            Self::Clothing => "clothing",
            Self::Health => "health",
            Self::Pharmacy => "pharmacy",
            Self::Fitness => "fitness",
            Self::Beauty => "beauty",
            Self::Education => "education",
            Self::Books => "books",
            Self::Entertainment => "entertainment",
            Self::Gaming => "gaming",
            Self::Music => "music",
            Self::Movies => "movies",
            Self::Subscriptions => "subscriptions",
            Self::Laundry => "laundry",
            Self::Electronics => "electronics",
            Self::Furniture => "furniture",
            Self::Sports => "sports",
            Self::Hobbies => "hobbies",
            Self::Transport => "transport",
            Self::Car => "car",
            Self::Fuel => "fuel",
            Self::Parking => "parking",
            Self::Bicycle => "bicycle",
            Self::Train => "train",
            Self::Flight => "flight",
            Self::Hotel => "hotel",
            Self::Travel => "travel",
            Self::Taxi => "taxi",
            Self::Boat => "boat",
            Self::Scooter => "scooter",
            Self::Taxes => "taxes",
            Self::Insurance => "insurance",
            Self::Savings => "savings",
            Self::Investments => "investments",
            Self::Salary => "salary",
            Self::Business => "business",
            Self::Transfer => "transfer",
            Self::Cash => "cash",
            Self::Credit => "credit",
            Self::Bills => "bills",
            Self::Work => "work",
            Self::Friends => "friends",
            Self::Other => "other",
            Self::Gifts => "gifts",
            Self::Charity => "charity",
            Self::Family => "family",
            Self::Childcare => "childcare",
            Self::Pets => "pets",
            Self::Repairs => "repairs",
            Self::Garden => "garden",
            Self::Cleaning => "cleaning",
            Self::Packages => "packages",
            Self::Outdoors => "outdoors",
            Self::Beach => "beach",
            Self::Party => "party",
            Self::Photos => "photos",
            Self::Hospital => "hospital",
            Self::Vision => "vision",
            Self::Kids => "kids",
            Self::Bank => "bank",
            Self::Legal => "legal",
            Self::Fees => "fees",
            Self::Haircut => "haircut",
            Self::Shipping => "shipping",
            Self::Icecream => "icecream",
            Self::Fruit => "fruit",
            Self::Software => "software",
            Self::Jewelry => "jewelry",
            Self::Cloud => "cloud",
            Self::Print => "print",
            Self::Tools => "tools",
            Self::Security => "security",
            Self::Supplies => "supplies",
            Self::Doctor => "doctor",
            Self::Firstaid => "firstaid",
            Self::Therapy => "therapy",
            Self::Yoga => "yoga",
            Self::Wellness => "wellness",
            Self::Camping => "camping",
            Self::Concert => "concert",
        }
    }
}

impl fmt::Display for CategoryIcon {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for CategoryIcon {
    type Err = ();

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        Self::ALL
            .iter()
            .copied()
            .find(|icon| icon.as_str() == value)
            .ok_or(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategory {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<CategoryIcon>,
    pub role: CategoryRole,
    pub parent: Option<Box<Self>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringCategoryImpact {
    pub recurring_transaction_id: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDeletionPreview {
    pub affected_recurring_transactions: Vec<RecurringCategoryImpact>,
    pub affected_budgets: Vec<BudgetImpact>,
    pub blocked_by_current_budget: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CategoryChildrenDeleteStrategy {
    Block,
    Promote,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransactionCategory {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<CategoryIcon>,
    pub role: Option<CategoryRole>,
}

impl NewTransactionCategory {
    pub fn validate(&self) -> Result<(), Error> {
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category name cannot be empty".to_string(),
            ));
        }
        validate_color(self.color.as_deref())?;
        validate_category_role(self.parent_id.as_deref(), self.role)?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionCategoryUpdate {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<CategoryIcon>,
    pub role: Option<CategoryRole>,
    #[serde(default)]
    pub confirm_budget_impact: bool,
}

impl TransactionCategoryUpdate {
    pub fn validate(&self) -> Result<(), Error> {
        if self.id.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category id is required for updates".to_string(),
            ));
        }
        if self.name.trim().is_empty() {
            return Err(Error::InvalidData(
                "Category name cannot be empty".to_string(),
            ));
        }
        if let Some(parent_id) = &self.parent_id
            && parent_id == &self.id
        {
            return Err(Error::InvalidData(
                "A category cannot be its own parent".to_string(),
            ));
        }
        validate_color(self.color.as_deref())?;
        validate_category_role(self.parent_id.as_deref(), self.role)?;
        Ok(())
    }
}

fn validate_category_role(
    parent_id: Option<&str>,
    role: Option<CategoryRole>,
) -> Result<(), Error> {
    let is_child = parent_id.is_some_and(|id| !id.trim().is_empty());

    match (is_child, role) {
        (false, None) => Err(Error::InvalidData(
            "Root categories require a role".to_string(),
        )),
        (true, Some(_)) => Err(Error::InvalidData(
            "Child categories inherit their root category role".to_string(),
        )),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use crate::features::transaction_categories::models::*;

    #[tokio::test]
    async fn test_new_transaction_category_validation() {
        let new_category = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            id: None,
        };

        new_category.validate().expect("validate");

        assert!(new_category.id.is_none());
        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.color.as_deref(), Some("#FF0000"));

        let new_category_invalid = NewTransactionCategory {
            name: "".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_new_transaction_category_rejects_invalid_color() {
        let new_category_invalid = NewTransactionCategory {
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("red".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            id: None,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_COLOR_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_transaction_category_update_validation() {
        let new_category = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        new_category.validate().expect("validate");

        assert_eq!(new_category.name, "Test Category");
        assert_eq!(
            new_category.description.as_deref(),
            Some("Descrizione test")
        );
        assert_eq!(new_category.color.as_deref(), Some("#FF0000"));

        let new_category_invalid = TransactionCategoryUpdate {
            id: "".to_string(),
            name: "Test".to_string(),
            parent_id: None,
            description: Some("Descrizione test".to_string()),
            color: Some("#FF0000".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        let result = new_category_invalid.validate();

        assert!(result.is_err());

        // Test self-reference validation
        let self_ref = TransactionCategoryUpdate {
            id: "same-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: Some("same-id".to_string()),
            description: None,
            color: None,
            icon: None,
            role: None,
            confirm_budget_impact: false,
        };

        let result = self_ref.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("cannot be its own parent")
        );

        let invalid_color = TransactionCategoryUpdate {
            id: "some-id".to_string(),
            name: "Test Category".to_string(),
            parent_id: None,
            description: None,
            color: Some("#12345".to_string()),
            icon: None,
            role: Some(CategoryRole::Spending),
            confirm_budget_impact: false,
        };

        let result = invalid_color.validate();
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains(INVALID_COLOR_MESSAGE)
        );
    }

    #[tokio::test]
    async fn test_normalize_optional_color_uppercases_valid_hex() {
        let normalized = normalize_optional_color(Some("#ff0000")).expect("normalize");

        assert_eq!(normalized.as_deref(), Some("#FF0000"));
    }

    #[tokio::test]
    async fn test_normalize_optional_color_keeps_none() {
        let normalized = normalize_optional_color(None).expect("normalize");

        assert!(normalized.is_none());
    }

    #[test]
    fn root_categories_require_a_role() {
        let category = NewTransactionCategory {
            id: None,
            parent_id: None,
            name: "Salary".to_string(),
            description: None,
            color: None,
            icon: None,
            role: None,
        };

        assert!(category.validate().is_err());
    }

    #[test]
    fn child_categories_reject_an_independent_role() {
        let category = NewTransactionCategory {
            id: None,
            parent_id: Some("root".to_string()),
            name: "Groceries".to_string(),
            description: None,
            color: None,
            icon: None,
            role: Some(CategoryRole::Income),
        };

        assert!(category.validate().is_err());
    }

    #[test]
    fn category_roles_use_stable_wire_values() {
        assert_eq!(
            serde_json::to_string(&CategoryRole::Spending).unwrap(),
            "\"spending\""
        );
        assert_eq!(
            serde_json::to_string(&CategoryRole::Income).unwrap(),
            "\"income\""
        );
    }

    #[test]
    fn category_icons_use_stable_wire_values() {
        assert_eq!(CategoryIcon::ALL.len(), 96);
        assert_eq!(
            serde_json::to_string(&CategoryIcon::Default).unwrap(),
            "\"default\""
        );
        assert_eq!(
            serde_json::to_string(&CategoryIcon::Food).unwrap(),
            "\"food\""
        );
        assert_eq!(
            serde_json::to_string(&CategoryIcon::Childcare).unwrap(),
            "\"childcare\""
        );
        for icon in CategoryIcon::ALL {
            assert_eq!(icon.as_str().parse::<CategoryIcon>(), Ok(icon));
        }
    }

    #[test]
    fn new_transaction_category_accepts_missing_icon() {
        let category: NewTransactionCategory =
            serde_json::from_str(r#"{"name":"Food","role":"spending"}"#).expect("decode");

        assert_eq!(category.icon, None);
        category.validate().expect("validate");
    }

    #[test]
    fn new_transaction_category_rejects_unknown_icon() {
        let result = serde_json::from_str::<NewTransactionCategory>(
            r#"{"name":"Food","role":"spending","icon":"spaceship"}"#,
        );

        assert!(result.is_err());
    }
}
