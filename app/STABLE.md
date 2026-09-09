# EverittOS stable points

Visuals are frozen. Use these refs to roll back without redesigning.

- `working-2026-09-04` — last tagged known-good production point
- `known-good-2026-09-09` — branch after load/session-only changes

Rollback:

```
git checkout working-2026-09-04
```

or

```
git checkout known-good-2026-09-09
```
