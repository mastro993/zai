# Persist stable category icon keys

Category icons are stored as nullable, immutable Zai semantic keys rather than Hugeicons export names. The backend accepts only Zai's additive curated catalogue, while the frontend maps each key to a Hugeicon; this duplicates the catalogue boundary across Rust and TypeScript but prevents dependency upgrades from changing or invalidating user choices.
