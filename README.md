# OPSX Chart

**Esplora le specifiche OpenSpec come una mappa e descrivi il comportamento come un grafo.** OPSX Chart è un'applicazione locale che si affianca a OpenSpec. Ogni capability nella mappa corrisponde a **una spec**: la mappa mostra come le spec sono collegate, mentre i flussi mostrano le casistiche di una singola spec.

Il grafo è il luogo in cui puoi preparare e modificare il comportamento. Una skill porta i WHEN/THEN scritti nel grafo nel delta Markdown del change, che puoi rivedere prima di sincronizzare la spec OpenSpec. OPSX Chart non richiede un fork di OpenSpec.

## I concetti principali

| Nell'interfaccia | Che cosa significa |
| --- | --- |
| **Capability** | Una spec OpenSpec. I suoi dettagli descrivono la spec e i suoi collegamenti con le altre capability; non sono l'elenco dei WHEN/THEN. |
| **Flusso** | Il grafo del comportamento di una capability. Può contenere eventi, azioni, decisioni ed esiti. Una capability può avere più flussi. |
| **WHEN** | La condizione di un ramo che esce da un nodo **Decisione**. Se una decisione ha due rami, ciascuno può avere il proprio WHEN. |
| **THEN** | Il risultato descritto nel nodo **Esito** raggiunto dal percorso. |
| **Casistica** | Un percorso completo dall'**Evento** all'**Esito**. Usa i WHEN dei rami attraversati e il THEN dell'esito, ed è destinato a uno scenario di un requisito OpenSpec. |

Per esempio, nel flusso di accesso il ramo «Valido» della decisione *Credenziali valide?* può contenere `WHEN un membro invia credenziali valide`; il nodo *Avvia sessione* può contenere `THEN il sistema avvia una sessione`. Se il percorso attraversa più decisioni, la skill scrive la prima condizione come `WHEN` e le successive come `AND` nello scenario Markdown.

### Change attivo e flusso in bozza

Il **change attivo** è il lavoro OpenSpec che hai selezionato, per esempio `adjust-login`. Raccoglie la proposta, i task, gli eventuali delta delle spec e le bozze dei grafi modificati.

Il **flusso in bozza** è la versione modificata di *un singolo grafo* dentro quel change. Quando cambi un WHEN, un THEN, un nodo o un collegamento e premi **Salva flusso**, salvi la bozza del grafo nel change. Il flusso **attuale** resta quello consolidato finché la bozza non viene riconciliata. Un change può contenere più flussi in bozza.

**In breve:** il change raccoglie il lavoro complessivo; la bozza è uno dei flussi modificati in quel lavoro.

## Come modificare una casistica

1. Seleziona una capability e apri **Flusso**. Nella colonna di destra trovi la spec associata e il link al suo documento Markdown.
2. Seleziona un **Change attivo** prima di modificare il comportamento. Apri il flusso in bozza, oppure modifica quello attuale per creare una bozza nel change.
3. Seleziona una **Decisione** nel grafo e premi **Collassa grafo e modifica**. In **WHEN per ciascun ramo** scrivi la condizione del ramo. Se esiste già testo nello scenario OpenSpec collegato, lo vedi accanto al campo vuoto e puoi premere **Usa questo WHEN** per copiarlo nel nodo.
4. Premi **Mostra grafo**, seleziona un **Esito** e scrivi il risultato in **THEN di questo esito**. Anche qui puoi vedere e copiare un THEN già presente nello scenario collegato.
5. In **Crea una nuova casistica**, scegli il requisito e aggiungi in ordine i collegamenti dall'Evento all'Esito. Puoi completare i WHEN e il THEN anche in questa form. Premi **Crea casistica nel flusso**, poi **Salva flusso**.

Puoi creare una casistica **prima** che esista il relativo scenario Markdown: comparirà come *da riconciliare*. La skill `$opsx-chart-graph-to-spec` legge i descrittori dei nodi e scrive o aggiorna lo scenario nel delta della spec del change. Salvare il grafo da solo non modifica il Markdown. Dopo aver rivisto entrambi, `$opsx-chart-sync` sincronizza la spec e riconcilia il grafo; `$opsx-chart-archive` chiude il change.

## Avvio locale

Servono Node.js 22 o successivo e la [CLI di OpenSpec](https://github.com/Fission-AI/OpenSpec) 1.14.0 o successiva. Se OpenSpec non è installato:

```sh
npm install -g @fission-ai/openspec@latest
```

Clona la repository e avvia l'app:

```sh
git clone https://github.com/TEX910/opsx-chart.git
cd opsx-chart
npm install
npm run build
npm start
```

Apri **http://127.0.0.1:4317**, indica il percorso di un progetto locale con una directory `openspec/` e premi **Apri progetto**. All'avvio l'app prova prima a usare la directory corrente.

### Prova la demo

Esegui `npm run demo` da questa repository e apri **http://127.0.0.1:4317**. La demo carica automaticamente il progetto `examples/demo-project/`, con due capability collegate, i flussi di accesso e notifica e il change `adjust-login`. Seleziona **authentication → Flusso** e confronta il flusso attuale con quello in bozza. Le modifiche che salvi nella demo vengono scritte nei file di `examples/demo-project/`.

## Skill disponibili

Le skill usano lo stesso change OpenSpec e lo stesso elenco di task, aggiungendo il lavoro sul grafo al normale flusso di sviluppo.

| Fase | Skill |
| --- | --- |
| Esplorare | `$opsx-chart-explore` |
| Proporre un change | `$opsx-chart-propose` |
| Aggiornare il piano | `$opsx-chart-update` |
| Implementare | `$opsx-chart-apply` |
| Portare WHEN/THEN dal grafo alla spec | `$opsx-chart-graph-to-spec` |
| Sincronizzare spec e grafi | `$opsx-chart-sync` |
| Archiviare | `$opsx-chart-archive` |

Le skill si trovano in `.agents/skills/`.

## Contribuire

Per setup di sviluppo, formato dei file, comandi CLI e dettagli della riconciliazione, leggi il [README per contributor](docs/README-CONTRIBUTORS.md).
