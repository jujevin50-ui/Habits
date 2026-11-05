# Sources des citations

La bibliothèque comprend **1 000 citations attribuées** : les 340 phrases originales de l’app ont été retirées et 300 classiques remplacés par des passages antiques. Les auteurs, œuvres et liens sont accessibles sous « Source » dans l’onglet Quotes. Le même catalogue alimente les notifications et la lecture hors ligne.

| Auteur | Œuvre | Passages importés |
|---|---|---:|
| Marc Aurèle | Pensées pour moi-même | 210 |
| Épictète | Manuel | 30 |
| Sénèque | Des bienfaits | 30 |
| Aristote | Éthique à Nicomaque | 30 |
| François de La Rochefoucauld | Réflexions ou sentences et maximes morales | 177 |
| Jean de La Bruyère | Les Caractères, édition de 1696 | 177 |
| Sébastien-Roch Nicolas de Chamfort | Maximes et pensées, Œuvres complètes, tome I | 176 |
| Germaine de Staël | De l’influence des passions sur le bonheur des individus et des nations | 125 |
| Jean de La Fontaine | Fables | 25 |

Ces 980 passages complètent 20 classiques antérieurs qui conservent leurs références d’œuvre. Aristote n’est pas classé parmi les stoïciens.

## Traductions et transcription

Les 210 passages de Marc Aurèle suivent la traduction de **Jules Barthélemy-Saint-Hilaire (1876)**, dans le domaine public. La transcription française est conservée dans le dépôt public `Ousseynou-Gaye/chatbot-nlp-rag`, fichier `data/processed/pensees_chunks.json`. Ce miroir identifie son texte comme celui de Wikisource. Chaque passage renvoie à sa ligne et à son livre/paragraphe (ou groupe de paragraphes de l’import), sans inventer de section plus précise. Seuls les marqueurs de notes, numéros de pagination isolés et espaces de mise en page sont retirés ; la graphie historique reste conservée. Les extraits sont signalés.

Les **90 passages d’Aristote, d’Épictète et de Sénèque** sont des traductions françaises faites pour Habits à partir des éditions anglaises de **D. P. Chase**, **Thomas Wentworth Higginson** et **Aubrey Stewart**, respectivement. Leur référence affiche explicitement « traduction française pour Habits d’après… ». Le champ `sourceText` conserve le passage anglais réellement utilisé, et le lien mène à celui-ci, pas à une édition française fictive. Les formulations françaises ne sont pas attribuées à un traducteur historique français. La sélection porte sur le caractère, l’action, les habitudes, la maîtrise de soi, l’amitié et la bienveillance. Elle écarte les introductions et commentaires des éditeurs.

Les 680 passages français conservés de La Rochefoucauld, La Bruyère, Chamfort, Staël et La Fontaine proviennent des éditions GITenberg déjà identifiées. Les extraits de paragraphes et groupes de vers sont signalés ; les graphies historiques restent conservées. Les numéros de « passage » et « paragraphe » servent au repérage dans l’import ; les lignes liées et numéros de maximes ou remarques permettent de retrouver les textes.

## Provenance et vérification

`editions.json` fixe les neuf dépôts, révisions, fichiers, encodages et sommes SHA-256. Les œuvres et traductions historiques utilisées sont dans le domaine public. La licence générale des éditions Project Gutenberg figure dans `LICENSE.txt` ; leurs notices et les crédits du miroir de Marc Aurèle sont conservés dans `CREDITS.txt`. Les notes et introductions modernes ne sont pas utilisées comme citations des auteurs antiques. La collection Debian fortunes-fr n’a servi que de piste bibliographique pour des vers de La Fontaine ensuite vérifiés dans l’édition primaire ; voir `FORTUNES-CREDITS.txt`.

```sh
python scripts/verify-classic-quotes.py --source-dir /chemin/des/sources --download
```

Le téléchargement conserve la vérification HTTPS et refuse toute somme SHA-256 différente. Le script vérifie 980 passages sources, leurs auteurs, leurs versions et leurs lignes liées. Pour les traductions, il contrôle la présence du passage **anglais** conservé ; la fidélité de la formulation française relève de la relecture éditoriale et ne peut pas être prouvée par une recherche textuelle. Les liens de Marc Aurèle sont aussi contrôlés contre l’identifiant de leur bloc JSON.
