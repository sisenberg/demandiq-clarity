import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppTopHeader from "./AppTopHeader";

const MainLayout = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopHeader />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
