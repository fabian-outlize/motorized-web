# Domain motorized.at auf GitHub Pages umhängen

Solange die alte WordPress-Seite unter motorized.at läuft, bleibt die Datei `CNAME`
bewusst aus dem Repo-Wurzelverzeichnis heraus. Sonst würde GitHub Pages sofort
versuchen, unter motorized.at auszuliefern — und die Seite wäre über keine der
beiden Adressen erreichbar.

## Zum Testen

Die Seite läuft nach dem ersten Deployment unter:

    https://<benutzername>.github.io/<repository>/

Alle internen Links sind relativ und funktionieren dort. Nur `canonical`, `og:url`
und `sitemap.xml` zeigen bereits auf motorized.at — das ist für einen Test egal.

## Wenn die Domain umziehen soll

1. Beim Domain-Anbieter (wo motorized.at registriert ist) diese DNS-Einträge setzen:

       A     @    185.199.108.153
       A     @    185.199.109.153
       A     @    185.199.110.153
       A     @    185.199.111.153
       CNAME www  <benutzername>.github.io

2. Im Repository unter **Settings → Pages → Custom domain** `motorized.at` eintragen
   und speichern. GitHub legt die Datei `CNAME` dann selbst an.

3. Warten, bis GitHub „DNS check successful" meldet (kann bis zu 24 Stunden dauern),
   danach **Enforce HTTPS** aktivieren.

Die vorbereitete Datei liegt hier als `CNAME-motorized.at` — du brauchst sie nur,
wenn du den Weg über Schritt 2 nicht gehen willst.
