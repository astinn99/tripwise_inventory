import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Package, Save } from 'lucide-react';
import { Modal } from '../ui/Modal';

const EMPTY_ITEM = {
  id: '',
  itemCode: '',
  description: '',
  category: '',
  quantity: '',
  minStockLevel: '',
  unit: 'Units',
  supplier: '',
  cost: '',
  location: '',
  serialNumber: '',
  warranty: '',
  condition: ''
};

const CATEGORY_CODE_PREFIX = {
  'Office Supplies': 'OFF',
  'Communication Devices': 'COM',
  'Maintenance Tools': 'TL',
  'Fleet Consumables': 'FLT',
};

export const AddEditItemModal = () => {
  const { activeModal, setActiveModal, modalData, saveInventoryItem } = useApp();

  const [formData, setFormData] = useState(EMPTY_ITEM);

  useEffect(() => {
    if (modalData) {
      setFormData(modalData);
    } else {
      setFormData(EMPTY_ITEM);
    }
  }, [modalData]);

  if (activeModal !== 'add_item' && activeModal !== 'edit_item') return null;

  const isEdit = activeModal === 'edit_item';
  const codePrefix = CATEGORY_CODE_PREFIX[formData.category] || '';
  const itemCodeDisplay = isEdit
    ? formData.itemCode
    : (codePrefix ? `${codePrefix}-###` : '');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveInventoryItem({
      ...formData,
      itemName: formData.description,
      itemCode: formData.itemCode || undefined,
    });
    setActiveModal(null);
  };

  return (
    <Modal
      asForm
      onSubmit={handleSubmit}
      onClose={() => setActiveModal(null)}
      icon={Package}
      tone="blue"
      size="lg"
      title={isEdit ? 'Edit Inventory Item' : 'Add New Inventory Item'}
      subtitle={isEdit ? 'Update specification, stock levels, and warehouse placement.' : 'Register a new SKU into the warehouse catalog.'}
      footer={(
        <>
          <button type="button" onClick={() => setActiveModal(null)} className="btn btn-outline btn-sm">Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm">
            <Save className="w-4 h-4" /> {isEdit ? 'Save Changes' : 'Create Item'}
          </button>
        </>
      )}
    >
      <div className="modal-section">
        <div className="modal-section-title">Item identity</div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Item Name</label>
            <input
              type="text"
              name="description"
              required
              className="form-control"
              placeholder="e.g. Heavy Duty Two-Way Handheld Radio"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select name="category" required className="form-select" value={formData.category} onChange={handleChange}>
              <option value="" disabled>Select category</option>
              <option value="Office Supplies">Office Supplies (OFF)</option>
              <option value="Communication Devices">Communication Devices (COM)</option>
              <option value="Maintenance Tools">Maintenance Tools (TL)</option>
              <option value="Fleet Consumables">Fleet Consumables (FLT)</option>
            </select>
          </div>
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Item Code</label>
          <input
            type="text"
            name="itemCode"
            readOnly
            className="form-control font-mono is-readonly"
            placeholder="Generated from category"
            value={itemCodeDisplay}
            title="Assigned automatically from the selected category."
          />
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Stock & costing</div>
        <div className="grid-3">
          <div className="form-group mb-0">
            <label className="form-label">Quantity</label>
            <input type="number" name="quantity" required min="0" className="form-control font-bold" placeholder="0" value={formData.quantity} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Min Stock Level</label>
            <input type="number" name="minStockLevel" required min="0" className="form-control" placeholder="0" value={formData.minStockLevel} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Unit Cost (₱)</label>
            <input type="number" name="cost" required min="0" step="0.01" className="form-control" placeholder="0.00" value={formData.cost} onChange={handleChange} />
          </div>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Supplier & location</div>
        <div className="grid-2">
          <div className="form-group mb-0">
            <label className="form-label">Primary Supplier</label>
            <input type="text" name="supplier" className="form-control" placeholder="e.g. PaperCorp Philippines" value={formData.supplier} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Storage Location</label>
            <input
              type="text"
              name="location"
              className="form-control"
              placeholder="e.g. Rack A -> Shelf 02 -> Bin 05"
              value={formData.location}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Condition & warranty</div>
        <div className="grid-3">
          <div className="form-group mb-0">
            <label className="form-label">Serial Number</label>
            <input type="text" name="serialNumber" className="form-control" placeholder="Optional" value={formData.serialNumber} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Warranty Expiry</label>
            <input type="text" name="warranty" className="form-control" placeholder="e.g. 2027-08-15" value={formData.warranty} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Item Condition</label>
            <select name="condition" className="form-select" value={formData.condition} onChange={handleChange}>
              <option value="">Select condition</option>
              <option value="New">New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};
