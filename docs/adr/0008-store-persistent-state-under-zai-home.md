---
status: accepted
---

# Store persistent state under Zai Home

Zai stores managed persistent state under one absolute Zai Home, defaulting to `~/.zai` on desktop and required through `ZAI_HOME` on web; private user data, including `zai.db`, lives under its `userdata` directory. This consistent cross-platform layout rejects OS-specific application-data directories and hidden database overrides so users and operators have one deterministic, inspectable storage root, accepting departure from platform conventions to avoid ambiguous or silently split financial data.
