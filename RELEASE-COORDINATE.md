# Gwenithic Release Coordinate

The Gravity Well follows the Gwenithic Release Coordinate working standard:

```text
GRC1:[artifact-id]@T<compact-utc>:V<semantic-version>:R<public-ordinal>[.<internal-ordinal>]
```

- `@` is the **scope aperture**. The artifact identifier to its left may be supplied by context; the separator remains when that prefix is omitted.
- `.` is the **disclosure aperture**. The internal ordinal to its right crosses into a public projection only when the artifact's permission envelope permits it.
- The compact UTC value is Crockford Base32 encoding of Unix epoch milliseconds, left-padded to ten characters and prefixed with `T`.
- The full UTC instant remains legible in the release manifest.
- The release ordinals are a pair of zero-based integers, never a decimal number.
- Semantic Versioning describes compatibility. Independent state schemas keep independent versions.
- A hash identifies an exact body. A parent coordinate and hash identify lineage. Neither is replaced by the human release name.

The first governed internal candidate is internal ordinal `0`. The first public Gravity Well release is public ordinal `0`. The public release manifest records whether the internal ordinal is included in its outward projection.

The complete Gwenithic-wide standard lives in Gwenithic's portable local institutional body. This file is the public project-local carrying copy needed to interpret Gravity Well releases away from that body.
