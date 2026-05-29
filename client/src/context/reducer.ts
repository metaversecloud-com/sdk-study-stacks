import {
  ActionType,
  CLEAR_SESSION,
  InitialState,
  SET_CONFIG,
  SET_DECKS,
  SET_ERROR,
  SET_HAS_INTERACTIVE_PARAMS,
  SET_MUTED,
  SET_SESSION,
  SET_VISITOR_DATA,
} from "./types";

const globalReducer = (state: InitialState, action: ActionType): InitialState => {
  const { type, payload } = action;
  switch (type) {
    case SET_HAS_INTERACTIVE_PARAMS:
      return { ...state, hasInteractiveParams: true };

    case SET_CONFIG:
      return {
        ...state,
        isAdmin: payload?.isAdmin ?? state.isAdmin,
        ecosystemDecks: payload?.ecosystemDecks ?? state.ecosystemDecks,
        userDecks: payload?.userDecks ?? state.userDecks,
        visitorStudyData: payload?.visitorStudyData ?? state.visitorStudyData,
        badges: payload?.badges ?? state.badges,
        visitorInventory: payload?.visitorInventory ?? state.visitorInventory,
        error: "",
      };

    case SET_DECKS:
      return {
        ...state,
        ecosystemDecks: payload?.ecosystemDecks ?? state.ecosystemDecks,
        userDecks: payload?.userDecks ?? state.userDecks,
        error: "",
      };

    case SET_VISITOR_DATA:
      return {
        ...state,
        visitorStudyData: payload?.visitorStudyData ?? state.visitorStudyData,
        visitorInventory: payload?.visitorInventory ?? state.visitorInventory,
        error: "",
      };

    case SET_SESSION:
      return { ...state, session: payload?.session, error: "" };

    case CLEAR_SESSION:
      return { ...state, session: undefined, error: "" };

    case SET_MUTED:
      return { ...state, muted: Boolean(payload?.muted) };

    case SET_ERROR:
      return { ...state, error: payload?.error ?? "" };

    default:
      return state;
  }
};

export { globalReducer };
