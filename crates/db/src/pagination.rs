use crate::connection::DbConnection;
use diesel::prelude::*;
use diesel::query_builder::*;
use diesel::query_dsl::methods::LoadQuery;
use diesel::sql_types::BigInt;
use diesel::sqlite::Sqlite;

pub trait Paginate: Sized {
    fn paginate(self, page: i64) -> Paginated<Self>;
}

impl<T> Paginate for T {
    fn paginate(self, page: i64) -> Paginated<Self> {
        Paginated {
            query: self,
            per_page: DEFAULT_PER_PAGE,
            page,
            offset: (page - 1) * DEFAULT_PER_PAGE,
        }
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
    pub fn per_page(self, per_page: i64) -> Self {
        Paginated {
            per_page,
            offset: (self.page - 1) * per_page,
            ..self
        }
    }

    pub fn load_page<'a, U>(self, conn: &mut DbConnection) -> QueryResult<Vec<U>>
    where
        Self: LoadQuery<'a, DbConnection, U>,
    {
        self.load(conn)
    }
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
            .per_page(10);

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
}
