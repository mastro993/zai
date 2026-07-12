use std::collections::{BTreeSet, HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CategoryHierarchy {
    pub id: String,
    pub parent_id: Option<String>,
}

pub fn canonicalize_category_ids(
    selected: &[String],
    categories: &[CategoryHierarchy],
) -> Vec<String> {
    let selected_ids = selected.iter().cloned().collect::<HashSet<_>>();
    let parents = categories
        .iter()
        .map(|category| (category.id.as_str(), category.parent_id.as_deref()))
        .collect::<HashMap<_, _>>();

    selected_ids
        .iter()
        .filter(|id| !has_selected_ancestor(id, &selected_ids, &parents))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub fn expand_category_scope(selected: &[String], categories: &[CategoryHierarchy]) -> Vec<String> {
    let selected_ids = selected.iter().map(String::as_str).collect::<HashSet<_>>();
    let category_ids = categories
        .iter()
        .map(|category| category.id.as_str())
        .collect::<HashSet<_>>();
    let parents = categories
        .iter()
        .map(|category| (category.id.as_str(), category.parent_id.as_deref()))
        .collect::<HashMap<_, _>>();
    categories
        .iter()
        .filter(|category| category_in_scope(&category.id, &selected_ids, &parents))
        .map(|category| category.id.clone())
        .chain(
            selected
                .iter()
                .filter(|id| !category_ids.contains(id.as_str()))
                .cloned(),
        )
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn has_selected_ancestor(
    id: &str,
    selected: &HashSet<String>,
    parents: &HashMap<&str, Option<&str>>,
) -> bool {
    let mut current = parents.get(id).copied().flatten();
    let mut visited = HashSet::new();
    while let Some(parent_id) = current {
        if !visited.insert(parent_id) {
            return false;
        }
        if selected.contains(parent_id) {
            return true;
        }
        current = parents.get(parent_id).copied().flatten();
    }
    false
}

fn category_in_scope(
    id: &str,
    selected: &HashSet<&str>,
    parents: &HashMap<&str, Option<&str>>,
) -> bool {
    let mut current = Some(id);
    let mut visited = HashSet::new();
    while let Some(category_id) = current {
        if !visited.insert(category_id) {
            return false;
        }
        if selected.contains(category_id) {
            return true;
        }
        current = parents.get(category_id).copied().flatten();
    }
    false
}
