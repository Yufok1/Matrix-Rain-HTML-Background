# Canvas5 media characters

Project Canvas-5 was created by Jeff Towers, also known as Tostido and Yufok1.
Copyright 2026 Jeff Towers. Commercial use requires a separate written license
from the creator. Its full Required Notice and PolyForm Noncommercial 1.0.0 terms
are preserved in Canvas5-PolyForm-Noncommercial.txt. These adapted components retain those terms; they are not relicensed under MIT.

Braille mask selection, stable flat patterns, contrast policy, and glyph coverage
ranking adapt capture-studio.js in Jeff's Canvas5 repo. The original Fine Dots
WOFF2 is extracted unchanged from its embedded CSS. Its geometry has four circles
per Unicode bit, not 32 independent image samples. The build script verifies all
256 masks and records whether rebuilding matches those embedded bytes.

The shading cells reuse the existing Omni MSDF font outlines and their bundled
SIL OFL notices, listed in THIRD-PARTY.md. No legacy Canvas5 React bundle, external
font pack, speech system, recorder, server, or model runtime is included.
