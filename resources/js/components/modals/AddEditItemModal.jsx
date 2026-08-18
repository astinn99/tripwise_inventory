import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ImagePlus, Package, Save, Trash2 } from 'lucide-react';
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
  storageLocationId: '',
  location: '',
  serialNumber: '',
  warranty: '',
  warrantyExpiresOn: '',
  condition: ''
};

const CATEGORY_CODE_PREFIX = {
  'Office Supplies': 'OFF',
  'Communication Devices': 'COM',
  'Maintenance Tools': 'TL',
  'Fleet Consumables': 'FLT',
};

export const AddEditItemModal = () => {
  const { activeModal, setActiveModal, modalData, saveInventoryItem, storageLocations } = useApp();

  const [formData, setFormData] = useState(EMPTY_ITEM);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (modalData) {
      setFormData(modalData);
      setImageFile(null);
      setRemoveImage(false);
      setPreviewUrl(modalData.imageUrl || '');
    } else {
      setFormData(EMPTY_ITEM);
      setImageFile(null);
      setRemoveImage(false);
      setPreviewUrl('');
    }
  }, [modalData, activeModal]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      return;
    }

    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(null);
    setPreviewUrl('');
    setRemoveImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveInventoryItem({
      ...formData,
      itemName: formData.description,
      itemCode: formData.itemCode || undefined,
      storageLocationId: formData.storageLocationId || null,
      imageFile,
      removeImage,
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
        <div className="modal-section-title">Item photo</div>
        <div className="item-photo-field">
          <button
            type="button"
            className="item-photo-picker"
            onClick={() => fileInputRef.current?.click()}
            title={previewUrl ? 'Change photo' : 'Upload photo'}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="item-photo-preview" />
            ) : (
              <span className="item-photo-placeholder">
                <ImagePlus className="w-5 h-5" />
                <span>Add photo</span>
              </span>
            )}
          </button>
          <div className="item-photo-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="item-photo-input"
              onChange={handleImageChange}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
              {previewUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {previewUrl ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleRemoveImage}>
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            ) : null}
            <p className="item-photo-hint">Optional. JPG, PNG, or WebP up to 5 MB. Shown only on inventory items.</p>
          </div>
        </div>
      </div>

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
            <select
              name="storageLocationId"
              className="form-select"
              value={formData.storageLocationId ? String(formData.storageLocationId) : ''}
              onChange={handleChange}
            >
              <option value="">Unassigned</option>
              {(storageLocations || []).map((loc) => (
                <option key={loc.id} value={String(loc.id)}>
                  {loc.label || `${loc.rack} → ${loc.shelf} → ${loc.bin}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Condition & warranty</div>
        <div className="grid-2">
          <div className="form-group mb-0">
            <label className="form-label">Serial Number</label>
            <input type="text" name="serialNumber" className="form-control" placeholder="Optional" value={formData.serialNumber} onChange={handleChange} />
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
          <div className="form-group mb-0">
            <label className="form-label">Warranty terms</label>
            <input type="text" name="warranty" className="form-control" placeholder="e.g. 12 months parts and labor" value={formData.warranty} onChange={handleChange} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Warranty Expiry</label>
            <input type="date" name="warrantyExpiresOn" className="form-control" value={formData.warrantyExpiresOn || ''} onChange={handleChange} />
          </div>
        </div>
      </div>
    </Modal>
  );
};
