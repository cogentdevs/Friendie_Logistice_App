import axios from 'axios';
import { appConfig } from '../../constants/appConfig';
import { installInterceptors } from './interceptors';
export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.requestTimeout,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});
installInterceptors(apiClient);
