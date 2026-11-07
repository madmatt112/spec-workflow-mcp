# Verification evidence — dashboard-board

The automated cases for the board live in the unit and browser suites
(`npm test` proves them on every run). Every line below must read
`passed` before the retrospective opens. The orchestrator relocates this
file to the main spec store at the merge gate.

- (scenario 1) pending — Requirement 6 AC 5. On a fixture run whose drive
  threw, Re-drive moves the tile to a green dot within 15 s of the
  step's spawn.
