import { DecksList } from "@/components";

// Admin view used to have Decks / Results tabs. Results moved per-deck (each
// deck row has a View Results icon button), so this collapses to just the
// decks list.
export const AdminView = () => <DecksList />;

export default AdminView;
