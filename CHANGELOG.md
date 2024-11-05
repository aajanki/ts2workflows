Version 0.4.0 - 2024-11-05

- Optional chaining a?.b is converted to map.get(a, "b")
- Non-null assertions person!.name is accepted but ignored to the transpiler
- Merge a next step to a preceeding assign step
- Accept a single-statement body (body without braces {}) in if, while, etc
- Assign the result of call_step() to a member variable: obj.property = call_step()
- parallel() and retry_policy() special functions can only be used as statements
- Better error messages on RegExp, BigInt, spread syntax and other non-supported Javascript features

Version 0.3.0 - 2024-10-19

- Function invocations no longer generate invalid empty variable names
- Include more utility types: ReturnType, Partial, Required, etc.
- Type annotation fixes

Version 0.2.0 - 2024-10-09

- Reduce cases where maps are needlessly split off into assign statements
- Accept (but ignore) "declare function"
- Implemented Array.isArray()
- Fixes to type annotations
