# lc-mods

Claude Code mods by Lorenzo Cocciarelli. This repository is a plugin
marketplace: add it once, then install any mod in it by name.

| Mod | What it does |
| --- | --- |
| [call-history](call-history/) | A pane, opened with `/calls`, listing the session's tool calls, skills and slash commands; click a row to see its command |
| [usage](usage/) | Context fill, rate-limit windows and session cost in the status line |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install call-history --marketplace LorenzoArkemis/lc-mods
/plugin install usage --marketplace LorenzoArkemis/lc-mods
```

The first install asks to add the marketplace: answer `y`, then pick a scope
(user is first). From a shell, use `claude plugin install <mod> --marketplace
LorenzoArkemis/lc-mods`. In the desktop app: click + next to the prompt box,
then Plugins, Add marketplace with `LorenzoArkemis/lc-mods`, then Add plugin.

## Layout

```
.claude-plugin/marketplace.json   lists every mod by its folder
call-history/                     one complete mod per folder
usage/
```

To add a mod, put its folder here and add an entry to `marketplace.json` with
`"source": "./<folder>"`.

## License

MIT, see [LICENSE](LICENSE).
