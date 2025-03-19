export const openModal = (id: string) => {
  const modalElement = document.getElementById(id) as HTMLDialogElement;
  modalElement.showModal();
};

export const closeModal = (id: string) => {
  const modalElement = document.getElementById(id) as HTMLDialogElement;
  modalElement.close();
};
