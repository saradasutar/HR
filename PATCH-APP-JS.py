#!/usr/bin/env python3
"""Patch HR native Work Diary revision payload; fail without changes on unexpected code."""
from pathlib import Path
import sys,shutil
p=Path(sys.argv[1] if len(sys.argv)>1 else 'app.js')
if not p.is_file():raise SystemExit('STOP: HR app.js not found')
s=p.read_text(encoding='utf-8')
if 'HR_SARNI_OFFICE_V33' in s:raise SystemExit('Already patched; no changes made')
changes=[
('    important: refs.diaryEntryImportant.checked\n  };\n  setButtonBusy(refs.saveDiaryEntryButton', '    important: refs.diaryEntryImportant.checked,\n    revision: state.diaryEditId ? state.diaryEntries.find(x => x.id === state.diaryEditId)?.revision : undefined\n  };\n  setButtonBusy(refs.saveDiaryEntryButton'),
('      id: e\n    });\n    state.diaryEntries = t.entries','      id: e,\n      revision: state.diaryEntries.find(x => x.id === e)?.revision\n    });\n    state.diaryEntries = t.entries')]
for a,b in changes:
 if s.count(a)!=1:raise SystemExit('STOP: missing/repeated HR app.js anchor; no changes written: '+a[:40])
 s=s.replace(a,b,1)
s='/* HR_SARNI_OFFICE_V33 */\n'+s
backup=p.with_name('app.js.BACKUP-before-SarNi-Office-v33')
if backup.exists():raise SystemExit('STOP: backup already exists; no changes written')
shutil.copy2(p,backup)
p.write_text(s,encoding='utf-8')
print('Patched '+str(p)+'; backup '+str(backup))
