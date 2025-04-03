import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DisplayGroup, DisplayGroupSchema } from '../../types/display';
import { useDisplays } from '../../hooks/useDisplays';
import './GroupForm.css';

interface GroupFormProps {
  group?: DisplayGroup;
  onSubmit: (data: DisplayGroup) => void;
  onCancel: () => void;
}

export const GroupForm: React.FC<GroupFormProps> = ({
  group,
  onSubmit,
  onCancel,
}) => {
  const { displays } = useDisplays();
  const isEditing = !!group;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<DisplayGroup>({
    resolver: zodResolver(DisplayGroupSchema),
    defaultValues: group || {
      name: '',
      description: '',
      displayIds: [],
    },
  });

  const selectedDisplays = watch('displayIds');

  const handleDisplayToggle = (displayId: string) => {
    const currentDisplays = selectedDisplays || [];
    const newDisplays = currentDisplays.includes(displayId)
      ? currentDisplays.filter(id => id !== displayId)
      : [...currentDisplays, displayId];
    
    // Update the form value
    register('displayIds').onChange({
      target: { name: 'displayIds', value: newDisplays },
    });
  };

  return (
    <div className="group-form">
      <h2>{isEditing ? 'Edit Group' : 'Create New Group'}</h2>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="form-group">
          <label htmlFor="name">Group Name</label>
          <input
            id="name"
            {...register('name')}
            className={errors.name ? 'error' : ''}
          />
          {errors.name && (
            <span className="form-error">{errors.name.message}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            {...register('description')}
            className={errors.description ? 'error' : ''}
          />
          {errors.description && (
            <span className="form-error">{errors.description.message}</span>
          )}
        </div>

        <div className="form-group">
          <div className="display-select">
            <div className="display-select-header">
              <h3>Select Displays</h3>
              <span className="display-count">
                {selectedDisplays?.length || 0} selected
              </span>
            </div>
            <div className="display-list">
              {displays.map(display => (
                <div key={display.id} className="display-item">
                  <input
                    type="checkbox"
                    id={`display-${display.id}`}
                    checked={selectedDisplays?.includes(display.id)}
                    onChange={() => handleDisplayToggle(display.id)}
                  />
                  <label htmlFor={`display-${display.id}`}>
                    {display.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          {errors.displayIds && (
            <span className="form-error">{errors.displayIds.message}</span>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="submit-button">
            {isEditing ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );
}; 