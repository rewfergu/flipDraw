import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

// Tell React that this environment supports `act(...)`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
