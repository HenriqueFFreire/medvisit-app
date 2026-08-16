# MedVisit

Aplicativo para gerenciamento de médicos, farmácias, visitas, agenda e roteiros de representantes farmacêuticos.

## Tecnologias

- React 19, TypeScript e Vite
- Firebase Authentication e Cloud Firestore
- Leaflet/OpenStreetMap para mapas
- Vercel para hospedagem

## Desenvolvimento

Crie `.env.local` com as variáveis `VITE_FIREBASE_*` do projeto Firebase e execute:

```bash
npm ci
npm run dev
```

## Verificações

```bash
npm run lint
npm run build
```

O workflow `Quality` executa essas verificações automaticamente em pushes e pull requests.

## Publicação

O push para a branch `main` inicia o deploy configurado na Vercel. As regras do Firestore ficam em `firestore.rules` e devem ser publicadas separadamente pelo Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

Revise o projeto Firebase selecionado antes de publicar as regras.
