export const composeDtrsRows = (documents = [], purchaseOrders = [], deliveries = []) => {
  const archived = Array.isArray(documents) ? documents : [];
  const seenPo = new Set(
    archived
      .filter((doc) => doc.type === 'Purchase Order')
      .map((doc) => doc.purchaseOrderNumber || doc.referenceNumber || doc.id)
  );
  const seenInsp = new Set(
    archived.filter((doc) => doc.type === 'Inspection Report').map((doc) => doc.id)
  );

  const poRows = (purchaseOrders || [])
    .filter((po) => po?.poNumber && !seenPo.has(po.poNumber))
    .map((po) => ({
      id: po.poNumber,
      title: `Purchase Order ${po.poNumber}`,
      type: 'Purchase Order',
      referenceNumber: po.poNumber,
      supplier: po.supplier || '',
      category: 'Procurement',
      itemCode: po.items?.[0]?.itemCode || '',
      purchaseOrderNumber: po.poNumber,
      issueDate: po.createdDate || '',
      expirationDate: po.confirmBy || '',
      status: po.poStatus || 'Active',
      fileUrl: po.manualFileUrl || null,
      source: 'purchase_order',
    }));

  const inspectionRows = (deliveries || [])
    .filter((delivery) => delivery?.inspectionResult && delivery.inspectionResult !== 'Pending' && !seenInsp.has(delivery.id))
    .map((delivery) => ({
      id: delivery.id,
      title: `${delivery.inspectionResult} inspection ${delivery.id}`,
      type: 'Inspection Report',
      referenceNumber: delivery.poNumber || delivery.id,
      supplier: delivery.supplier || '',
      category: 'Receiving',
      itemCode: delivery.itemsDelivered?.[0]?.itemCode || '',
      purchaseOrderNumber: delivery.poNumber || '',
      issueDate: delivery.deliveryDate || '',
      expirationDate: '',
      status: delivery.inspectionResult,
      fileUrl: null,
      source: 'inspection',
    }));

  return [...archived, ...poRows, ...inspectionRows];
};
