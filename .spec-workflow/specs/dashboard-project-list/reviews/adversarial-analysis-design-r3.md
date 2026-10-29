S-1: addressed — v3 Testing Strategy > Integration (design.md:190) now reads the per-worker registry while the child is alive, after the startup line and before stdin closes, asserting no fixture entry (red at base, green after C7); Revision History R2-1 (design.md:222) states this explicitly and cites server.ts:289-290/234/195, which match the live tree.

VERIFIED: 1/1
