---
status: accepted
---

# Commit release versions before building

Zai releases both Stable and Nightly from version commits on `main`: public versions use shared UTC `Y.M.D.B`, manifests encode them as SemVer `Y.M.(D×1000+B)`, Stable tags use `Y.M.D.B`, and Nightly tags use `nightly-Y.M.D.B`. The workflow creates a draft release before building, removes its draft and tag if artifact publication fails, but retains the version commit rather than rewriting `main`; the committed version is the allocation source, so a retry receives a new build number without reconstructing state from tags. Published releases remain immutable if the atomic GitHub Pages projection fails and a separate recovery workflow republishes manifests. This supersedes ADR-0006: committed versions make release inputs inspectable and reproducible, while consumed build numbers and explicit recovery are accepted in exchange for never rewriting shared history.
