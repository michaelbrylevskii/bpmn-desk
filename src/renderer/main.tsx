import { createRoot } from 'react-dom/client';
import { App } from './app';
import { LanguageProvider } from './i18n/provider';
import { bridge } from './platform/bridge';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import './styles/theme.css';
import './styles/layout.css';
import './styles/editor.css';
import './styles/xml-search.css';

const root = document.getElementById('root');
if (!root) throw new Error('Не найден root приложения.');
bridge.language().then(language => { createRoot(root).render(<LanguageProvider initial={language}><App /></LanguageProvider>); }).catch(error => { root.textContent = String(error); });
