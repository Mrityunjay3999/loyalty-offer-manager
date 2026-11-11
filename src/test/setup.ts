// Load the imported base once per test file, like the app does at start (v3 A7).
import { ensureBaseLoaded } from '@/store/useAppStore';

await ensureBaseLoaded();
