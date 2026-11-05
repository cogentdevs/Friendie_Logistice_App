import { ImageSourcePropType } from 'react-native';
// Static destination directory, not server popularity, coverage or availability data.
export type HomeDestination = {
  code: string;
  label: string;
  country: string;
  photo?: ImageSourcePropType;
  photoFit?: 'contain' | 'cover';
};
export const homeDestinations: HomeDestination[] = [
  {
    code: 'AE',
    label: 'UAE',
    country: 'United Arab Emirates',
    photo: require('../../../assets/demo-destinations/uae.jpg'),
    photoFit: 'contain',
  },
  {
    code: 'SA',
    label: 'Saudi Arabia',
    country: 'Saudi Arabia',
    photo: require('../../../assets/demo-destinations/saudi-arabia.jpg'),
  },
  {
    code: 'PK',
    label: 'Pakistan',
    country: 'Pakistan',
    photo: require('../../../assets/demo-destinations/pakistan.jpg'),
  },
  {
    code: 'GB',
    label: 'United Kingdom',
    country: 'United Kingdom',
    photo: require('../../../assets/demo-destinations/united-kingdom.jpg'),
  },
];
