# Sources des citations classiques

La bibliothèque comprend exactement **1 000 citations attribuées** et **340 phrases originales**, conservées séparément par le champ `author` (null pour les phrases originales).

Les 20 citations classiques antérieures sont conservées avec leurs références. Les **980 ajouts** sont transcrits à partir de cinq éditions françaises identifiables :

| Auteur | Œuvre | Ajouts |
|---|---|---:|
| François de La Rochefoucauld | Réflexions ou sentences et maximes morales | 300 |
| Jean de La Bruyère | Les Caractères, édition de 1696 | 310 |
| Sébastien-Roch Nicolas de Chamfort | Maximes et pensées, Œuvres complètes, tome I, édition de 1824 | 220 |
| Germaine de Staël | De l’influence des passions sur le bonheur des individus et des nations | 125 |
| Jean de La Fontaine | Fables, édition de 1868 | 25 |

Chaque ajout comporte son auteur, une référence d’œuvre, un lien vers une ligne de l’édition numérisée à une révision figée et un identifiant `sourceId`. Les extraits de paragraphes plus longs sont signalés par `(extrait)`. Les graphies historiques sont conservées ; seules les coupures de ligne, marques d’italique et références éditoriales sont retirées. Un extrait contient une phrase complète, ou un groupe de vers, et n’est pas une paraphrase inventée. Les compteurs « passage » et « paragraphe » servent au repérage dans l’import ; la ligne liée et les numéros de maximes/remarques permettent de vérifier dans le texte.

Le choix privilégie les pensées autonomes sur le caractère, les relations humaines, la lucidité, l’apprentissage, le courage, le travail, le temps et le bonheur. Le corpus n’est pas une garantie de vérité universelle des opinions historiques de ces auteurs. Il ne présente pas les phrases originales comme des citations de philosophes.

`editions.json` fixe les dépôts, révisions, noms de fichiers, encodages et sommes SHA-256 des cinq transcriptions. Les textes littéraires de ces auteurs et éditions sont dans le domaine public. Les miroirs sont ceux de GITenberg ; les fichiers complets contiennent les notices de l’édition numérique. La licence générale des éditions Project Gutenberg est fournie dans `LICENSE.txt` ; les notices de production d’origine sont conservées dans `CREDITS.txt`.

> This eBook is for the use of anyone anywhere at no cost and with almost no restrictions whatsoever. You may copy it, give it away or re-use it under the terms of the Project Gutenberg License included with this eBook or online at https://www.gutenberg.org/license.

La collection Debian fortunes-fr a servi uniquement de piste bibliographique pour retrouver certains vers de La Fontaine, qui ont ensuite été contrôlés dans l’édition primaire. Sa provenance et ses conditions figurent dans `FORTUNES-CREDITS.txt`.

Pour vérifier les 980 ajouts contre les fichiers d’origine :

```sh
python scripts/verify-classic-quotes.py --source-dir /chemin/des/cinq/fichiers
```

L’option `--download` permet de télécharger les cinq versions figées dans ce dossier avant vérification. Le script conserve la vérification HTTPS et refuse un fichier dont la somme SHA-256 diffère du manifeste.
