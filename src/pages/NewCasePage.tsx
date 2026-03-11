import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateCaseDialog from "@/components/case/CreateCaseDialog";

/** Route wrapper that opens the Create Case dialog and navigates back on close. */
const NewCasePage = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    navigate("/cases");
  };

  return <CreateCaseDialog open={open} onClose={handleClose} />;
};

export default NewCasePage;
