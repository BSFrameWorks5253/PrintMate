
PrintMate/
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   └── CODEBASE_ARCHITECTURE.md
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   │   ├── image.ipc.ts
│   │   ├── document.ipc.ts
│   │   ├── print.ipc.ts
│   │   ├── file.ipc.ts
│   │   └── settings.ipc.ts
│   ├── services/
│   │   ├── image-processing.service.ts
│   │   ├── background-removal.service.ts
│   │   ├── pdf.service.ts
│   │   ├── print.service.ts
│   │   └── file-storage.service.ts
│   └── database/
│       ├── database.ts
│       ├── migrations/
│       └── repositories/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── common/
│   │   ├── editor/
│   │   ├── layout/
│   │   └── print-preview/
│   ├── pages/
│   │   ├── Home/
│   │   ├── ImageEditor/
│   │   ├── PageLayout/
│   │   ├── PrintPreview/
│   │   ├── JobHistory/
│   │   └── Settings/
│   ├── features/
│   │   ├── import/
│   │   ├── straighten/
│   │   ├── enhancement/
│   │   ├── background-removal/
│   │   ├── photo-layout/
│   │   ├── duplex-print/
│   │   └── export/
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   ├── utils/
│   └── styles/
├── resources/
│   ├── models/
│   ├── icons/
│   └── templates/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
└── README.md
