<!-- À insérer dans le skill « lecture-extractions-simone », juste après la section
     « Structure du fichier » et avant « La règle de lecture centrale ». -->

## Les étiquettes posées par le notaire

Simone permet au notaire de **qualifier lui-même** ce qu'il relève. L'export peut donc
porter deux mentions supplémentaires :

- sous le titre `## nom-du-document.pdf`, une ligne `Nature du document : …`
  (en `.md` : `**Nature du document :** …`) — par exemple « État daté », « Titre de
  propriété », « Pièce d'identité — acquéreur » ;
- sous l'en-tête d'une capture (`[Page N · …]` ou `### Page N — …`), une ligne
  `Étiquette : …` (en `.md` : `**Étiquette :** …`) — par exemple « Immatriculation de la
  copropriété », « État civil — vendeur », « Prix de vente ».

Lorsque des étiquettes sont présentes, le fichier commence par la phrase : « Les mentions
« Nature du document » et « Étiquette » ont été posées par le notaire : elles qualifient
l'information extraite et priment sur toute déduction. »

**Attention au vocabulaire.** Dans la suite de ce skill, « étiquette » désigne aussi une
capture-intitulé (« fonds de roulement ») qui attend sa valeur. La ligne `Étiquette :` est
autre chose : ce n'est **pas du texte extrait du document**, c'est la qualification
donnée par le notaire à la capture qui suit. Ne jamais la confondre avec le texte capturé,
ni la citer comme si elle figurait dans l'acte.

Règles de lecture :

1. **L'étiquette du notaire prime.** Une capture étiquetée « État civil — acquéreur » se
   rapporte à l'acquéreur, même si le texte seul laissait penser au vendeur. Ne pas
   requalifier ; si le texte paraît contredire l'étiquette (un montant sous « État civil »,
   un nom de société sous « Prix de vente »), restituer selon l'étiquette **et** signaler
   l'incohérence dans les points à vérifier.
2. **Une capture étiquetée est autonome.** Elle forme à elle seule le couple
   intitulé → valeur : l'étiquette tient lieu d'intitulé, le texte de valeur. Ne pas lui
   chercher de partenaire parmi les captures voisines (règle d'appariement non applicable),
   et ne pas s'en servir comme intitulé pour la capture suivante.
3. **Les captures sans étiquette** se lisent comme avant, selon la règle d'appariement de
   la section suivante.
4. **Plusieurs captures sous la même étiquette** (par exemple deux « État civil —
   vendeur ») : soit plusieurs vendeurs, soit une même information prise en plusieurs
   morceaux. Les réunir sous cette rubrique, dans l'ordre du geste, sans trancher sans le
   dire.
5. **La nature du document** oriente la lecture de toute la section (on ne lit pas un état
   daté comme un titre de propriété) et sert d'intitulé de section dans la restitution :
   `## etat-date.pdf — État daté`.
6. **Restitution.** Dans le tableau, la colonne « Poste » reprend l'étiquette telle
   quelle (au lieu d'un intitulé recomposé), et la colonne « Source » mentionne
   « étiquette du notaire ». Les rubriques de personnes (État civil, Domicile, Régime
   matrimonial — vendeur / acquéreur…) peuvent être regroupées par partie, avant les
   données du bien et du prix.

Exemple :

```
## titre-propriete.pdf
Nature du document : Titre de propriété

[Page 1 · texte natif]
Étiquette : État civil — vendeur
Monsieur Jean DUPONT, né à Lyon le 3 mars 1961

[Page 4 · OCR 88%]
Étiquette : Immatriculation de la copropriété
AB1-234-567
```

Lecture :

```markdown
## titre-propriete.pdf — Titre de propriété

| Poste | Valeur | Page | Source |
|---|---|---|---|
| État civil — vendeur | Monsieur Jean DUPONT, né à Lyon le 3 mars 1961 | 1 | texte natif · étiquette du notaire |
| Immatriculation de la copropriété | AB1-234-567 | 4 | OCR 88 % · étiquette du notaire |
```
