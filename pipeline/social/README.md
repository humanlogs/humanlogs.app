# Social posts — `pipeline/social/`

Un fichier Markdown = une proposition de post. La sync kan.bn
(`pipeline/kanbn-sync.ts`) crée **une carte par fichier** dans la liste
`humanlogs.app` du board **Social**, en sautant toute carte dont le titre
existe déjà (le titre est l'identité stable). Ce `README.md` est ignoré par la
sync.

> Le détail du ton et du format du corps vit dans le skill `kanbn`
> (`.claude/skills/kanbn/SKILL.md`) et le `brand-voice` du repo. Ce fichier ne
> documente que le **format machine** lu par le script.

## Format d'un fichier

Nom suggéré : `<date>-<platform>-<keyword-slug>.md`

```markdown
---
platform: linkedin        # linkedin | reddit
keyword: <keyword cible>
date: <YYYY-MM-DD>
# subreddit: <subreddit>   # reddit uniquement
---
<corps du post / commentaire, prêt à copier-coller>
```

### Frontmatter (obligatoire)

| Clé | Requis | Notes |
|---|---|---|
| `platform` | oui | `linkedin` ou `reddit` |
| `keyword` | oui | le keyword cible du post |
| `date` | oui | `YYYY-MM-DD` |
| `subreddit` | reddit | nom du subreddit (reddit uniquement) |

Si `platform`, `keyword` ou `date` manque, la sync échoue avec une erreur.

### Titre de carte (dérivé, ne pas mettre dans le fichier)

- LinkedIn → `[LinkedIn] <keyword> — <date>`
- Reddit → `[Reddit/r/<subreddit>] <keyword> — <date>`

⚠️ Comme le titre est l'identité de la carte, **ne renomme pas** le `keyword`/
`date` d'un post déjà synchronisé : ça créerait un doublon sur le board.
