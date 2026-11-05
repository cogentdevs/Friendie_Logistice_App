import { Keyboard } from 'react-native';
import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react-native';
import { SearchDatePicker } from '../../search/components/SearchDatePicker';
import { displayDate } from '../../search/types/search';
import { ListingFormField } from './ListingFormField';
export function ListingDateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ListingFormField
        label={label}
        value={value ? displayDate(value) : undefined}
        placeholder="Select date"
        icon={CalendarDays}
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        error={error}
      />
      {open && (
        <SearchDatePicker
          mode="single"
          title={label}
          value={value ? { start: value, end: value } : undefined}
          onApply={selection => {
            onChange(selection?.start ?? '');
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
