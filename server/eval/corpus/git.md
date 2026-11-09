# Git essentials

Git stores history as a graph of commits. Use `git stash` to temporarily shelve uncommitted changes so you can switch branches with a clean working tree, and `git stash pop` to bring them back.

Merging combines two branches and records a merge commit, which preserves the true history. Rebasing replays your commits on top of another branch, producing a linear history, but it rewrites commit hashes, so you should never rebase commits that teammates have already pulled.

If you lose work after a hard reset or a bad rebase, the reflog is your safety net. `git reflog` lists every position HEAD has pointed to recently, and you can restore a lost commit with `git reset --hard <hash>` or `git checkout -b rescue <hash>`. Entries expire after roughly 90 days by default.

`git cherry-pick <hash>` applies a single commit from another branch onto your current branch without merging everything else.
