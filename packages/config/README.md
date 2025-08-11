# @gescat/config
Collezione di configurazioni condivise nei vari progetti/pacchetti

```
├── config/
│   ├── expo/  //configurazioni comuni ma specifiche di expo
│   │   ├── plugin/  //configurazioni comuni per plugin per expo
│   │   ├── app.config.ts // configurazione in formato ts di base
│   │   ├── eas.json  // Configurazione per compilazione in cloud di base
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   ├── lib/  //configurazioni specifiche di librerie installate comuni
│   │   ├── drizzle.config.ts //se usi la lib drizzle per ORM
│   │   ├── jest.config.ts  //se usi la lib jest per i testi
│   │   ├── tailwind.config.ts  //se usi la lib tailwind
│   ├── tools/  //configurazioni specifiche di tool comuni
│   │   ├── biome.json  // se usi biome - config specifica e comune di tutto il progetto
```
