import { ReactNode, useContext } from "react";

// components
import { Loading } from "@/components";

// context
import { GlobalStateContext } from "@context/GlobalContext";

export const PageContainer = ({
  children,
  isLoading,
  headerText,
}: {
  children: ReactNode;
  isLoading: boolean;
  headerText?: string;
}) => {
  const { error } = useContext(GlobalStateContext);

  if (isLoading) return <Loading />;

  return (
    <div className="p-4">
      {headerText && (
        <div className="pb-6">
          <h2>{headerText}</h2>
        </div>
      )}
      {children}
      {error && <p className="p3 pt-10 text-center text-error">{error}</p>}
    </div>
  );
};

export default PageContainer;
