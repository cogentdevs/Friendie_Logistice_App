import React from 'react';
import Renderer, { ReactTestRenderer } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { apiClient } from '../src/services/api/apiClient';
import { secureStorage } from '../src/services/storage/secureStorage';
import { useAuthStore } from '../src/store/authStore';
import { useListingDraft } from '../src/features/post-listing/store/listingDraftStore';
import { useEditListingDraft } from '../src/features/post-listing/store/editListingDraftStore';
import { PostListingScreen } from '../src/features/post-listing/screens/PostListingScreen';
import { ListingReviewScreen } from '../src/features/post-listing/screens/ListingReviewScreen';
import { ListingImageInput } from '../src/features/post-listing/components/ListingImageInput';
import { useUpdateListing } from '../src/features/post-listing/hooks/useUpdateListing';
import {
  loadListingEdit,
  editContext,
} from '../src/features/post-listing/services/updateListingService';
import {
  createListingDraft as draft,
  createdListingRecord as record,
  referenceResponse,
} from '../test/fixtures/createListing';
import { ApiError } from '../src/types/api';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) =>
    require('react').useEffect(effect, [effect]),
  usePreventRemove: jest.fn(),
}));
jest.mock('@react-navigation/elements', () => ({
  ...jest.requireActual('@react-navigation/elements'),
  useHeaderHeight: () => 56,
}));
let tree: ReactTestRenderer, client: QueryClient, put: jest.SpyInstance;
let control: ReturnType<typeof useUpdateListing>;
const parentNavigate = jest.fn(),
  saved = jest.fn(),
  navigation = {
    navigate: jest.fn(),
    replace: jest.fn(),
  reset: jest.fn(),
    setOptions: jest.fn(),
    getState: () => ({ index: 1 }),
    getParent: () => ({ navigate: parentNavigate }),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  };
function Probe({ focused = true }: { focused?: boolean }) {
  control = useUpdateListing('123', focused, saved);
  return null;
}
async function mount(element: React.ReactNode = <Probe />) {
  await Renderer.act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
}
async function press(label: string) {
  await Renderer.act(async () => {
    await tree.root
      .findAll(
        node =>
          node.props.accessibilityLabel === label &&
          typeof node.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
}
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Toast, 'show').mockImplementation(() => {});
  useAuthStore
    .getState()
    .setUser({ id: 8, name: 'Test', email: 'test@example.test' });
  jest.spyOn(secureStorage, 'getToken').mockResolvedValue('edit-test-token');
  jest.spyOn(apiClient, 'get').mockImplementation(async (url, config) =>
    url === '/customer/listings/123'
      ? {
          status: 200,
          data: { success: true, message: 'Owned', data: record },
        }
      : referenceResponse(url, config),
  );
  put = jest
    .spyOn(apiClient, 'put')
    .mockImplementation(async (_url, payload) => ({
      status: 200,
      data: {
        success: true,
        message: 'Updated',
        data: { ...record, ...(payload as object) },
      },
    }));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const context = await loadListingEdit('123');
  useEditListingDraft.setState({
    listingId: '123',
    values: context.initial,
    dirty: false,
  });
});
afterEach(async () => {
  await Renderer.act(async () => {
    tree?.unmount();
    client?.clear();
    useAuthStore.getState().clear();
  });
  jest.restoreAllMocks();
});
test('shared edit form prefills authoritative title/zero and hides create image picker', async () => {
  useListingDraft.getState().update({ ...draft, title: 'Unsaved create' });
  await mount(
    <PostListingScreen
      navigation={navigation as never}
      route={{
        key: 'edit',
        name: 'PostListing',
        params: { editListingId: '123' },
      }}
    />,
  );
  expect(
    tree.root
      .findAllByType(TextInput)
      .some(node => node.props.value === record.title),
  ).toBe(true);
  expect(
    tree.root.findAllByType(TextInput).some(node => node.props.value === '0'),
  ).toBe(true);
  expect(tree.root.findAllByType(ListingImageInput)).toHaveLength(0);
  expect(navigation.setOptions).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Edit Listing' }),
  );
  await press('Continue');
  expect(navigation.navigate).toHaveBeenCalledWith('ListingReview', {
    editListingId: '123',
  });
  expect(useListingDraft.getState().values.title).toBe('Unsaved create');
});
test('review uses Save changes without creation or image upload', async () => {
  const post = jest.spyOn(apiClient, 'post');
  useEditListingDraft.getState().update({ ...draft, title: 'Changed' });
  await mount(
    <ListingReviewScreen
      navigation={navigation as never}
      route={{
        key: 'review',
        name: 'ListingReview',
        params: { editListingId: '123' },
      }}
    />,
  );
  expect(
    tree.root.findAll(
      node => node.props.accessibilityLabel === 'Create listing',
    ),
  ).toHaveLength(0);
  await press('Save changes');
  expect(put).toHaveBeenCalledTimes(1);
  expect(post).not.toHaveBeenCalled();
  expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PostListing' }] });
  expect(parentNavigate).toHaveBeenCalledWith('ListingsStack', {
    screen: 'ListingDetails',
    params: { listingId: '123', returnTo: 'MyListings' },
  });
});

test('edit hydrates local unchanged pin draft, preserves on unrelated edit and tracks explicit removal without network writes', async () => {
  const context = editContext('123')!;
  context.draft = { ...context.initial, fromPin: { text: '0, 0', intent: 'unchanged' } };
  await mount(<PostListingScreen navigation={navigation as never} route={{key:'edit', name:'PostListing', params:{editListingId:'123'}}} />);
  const input = (label: string) => tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;
  expect(input('From Location Pin (Optional)').props.value).toBe('0, 0');
  expect(input('To Location Pin (Optional)').props.value).toBe('');
  await Renderer.act(async () => input('Title').props.onChangeText('Local edit'));
  expect(useEditListingDraft.getState().values.fromPin?.intent).toBe('unchanged');
  await press('Clear from location pin');
  expect(useEditListingDraft.getState().values.fromPin).toEqual({text:'',intent:'clear'});
  await Renderer.act(async () => input('To Location Pin (Optional)').props.onChangeText('1,2'));
  expect(useEditListingDraft.getState().values.toPin).toEqual({text:'1,2',intent:'replace'});
  expect(put).not.toHaveBeenCalled();
});

test('owner API coordinates hydrate actual Edit inputs without dirty pin intent or image changes', async () => {
  getOwnerPins();
  await mount(<PostListingScreen navigation={navigation as never} route={{key:'edit',name:'PostListing',params:{editListingId:'123'}}} />);
  const inputs = tree.root.findAllByType(TextInput);
  expect(inputs.find(node => node.props.accessibilityLabel === 'From Location Pin (Optional)')?.props.value).toBe('0, 0');
  expect(inputs.find(node => node.props.accessibilityLabel === 'To Location Pin (Optional)')?.props.value).toBe('-33.8688197, 151.2092955');
  expect(useEditListingDraft.getState().values.fromPin?.intent).toBe('unchanged');
  expect(tree.root.findAllByType(ListingImageInput)).toHaveLength(0);
  expect(put).not.toHaveBeenCalled();
});
function getOwnerPins() {
  jest.spyOn(apiClient,'get').mockImplementation(async (url,config) => url === '/customer/listings/123' ? {status:200,data:{success:true,message:'Owned',data:{...record,from_latitude:0,from_longitude:0,to_latitude:-33.8688197,to_longitude:151.2092955}}} : referenceResponse(url,config));
}

test('confirmed saved-pin clear invalidates existing owner caches without public coordinate insertion', async () => {
  const context = editContext('123')!;
  context.original = {...context.original,from_latitude:0,from_longitude:0};
  context.initial = {...context.initial,fromPin:{text:'0, 0',intent:'unchanged'}};
  useEditListingDraft.getState().update({...context.initial,fromPin:{text:'',intent:'clear'}});
  const ownKey = ['ownListingDetails',8,'123'];
  const publicKey = ['listingDetails','123'];
  client.setQueryData(ownKey,{backend:context.original});
  client.setQueryData(publicKey,{id:123,title:'Public'});
  await mount();
  await Renderer.act(async () => control.submit());
  expect(put.mock.calls[0][1]).toEqual({from_latitude:null,from_longitude:null});
  expect(client.getQueryState(ownKey)?.isInvalidated).toBe(true);
  expect(client.getQueryData(publicKey)).toEqual({id:123,title:'Public'});
  expect(saved).toHaveBeenCalledWith(123);
});
test('success invalidates scoped caches, retains filters/pages, no Dashboard counter fabrication', async () => {
  const mine = ['myListings.read', 'user:8', 'active'],
    other = ['myListings.read', 'user:9', 'active'],
    dashboard = ['profileDashboard', 'user:8', 'summary'];
  client.setQueryData(mine, { pages: [{ id: 123 }], pageParams: [1] });
  client.setQueryData(other, { private: 'other' });
  client.setQueryData(dashboard, { unread_messages: 12 });
  client.setQueryData(['ownListingDetails', 8, '123'], record);
  await mount();
  useEditListingDraft.getState().update({ ...draft, title: 'Changed' });
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(saved).toHaveBeenCalledWith(123);
  expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  expect(client.getQueryData(mine)).toEqual({
    pages: [{ id: 123 }],
    pageParams: [1],
  });
  expect(client.getQueryData(dashboard)).toEqual({ unread_messages: 12 });
  expect(client.getQueryState(dashboard)?.isInvalidated).toBe(false);
  expect(Toast.show).toHaveBeenCalledTimes(1);
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'success' }),
  );
});
test('no changes emits info only and stays', async () => {
  await mount();
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(put).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'info' }),
  );
});
test('422 errors remain visible and edited draft is preserved', async () => {
  put.mockRejectedValue(
    new ApiError('Invalid', 'validation', 422, { title: ['Title rejected'] }),
  );
  await mount();
  const edited = { ...draft, title: 'Changed' };
  useEditListingDraft.getState().update(edited);
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(control.errors).toEqual({ title: ['Title rejected'] });
  expect(useEditListingDraft.getState().values).toBe(edited);
  expect(saved).not.toHaveBeenCalled();
  expect(control.held).toBe(false);
});
test('timeout preserves edited draft and blocks a second PUT', async () => {
  put.mockRejectedValue(new ApiError('Timeout', 'network'));
  await mount();
  const edited = { ...draft, title: 'Changed' };
  useEditListingDraft.getState().update(edited);
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(control.held).toBe(true);
  expect(useEditListingDraft.getState().values).toBe(edited);
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(put).toHaveBeenCalledTimes(1);
  expect(saved).not.toHaveBeenCalled();
});
test('duplicate controller calls share an in-flight guard', async () => {
  await mount();
  useEditListingDraft.getState().update({ ...draft, title: 'Changed' });
  await Renderer.act(async () => {
    await Promise.all([control.submit(), control.submit()]);
  });
  expect(put).toHaveBeenCalledTimes(1);
});
test('another active listing draft cannot submit against this context', async () => {
  await mount();
  useEditListingDraft.setState({
    listingId: '999',
    values: { ...draft, title: 'Other' },
  });
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(put).not.toHaveBeenCalled();
});
test('logout clears edit draft and contexts without changing create lifecycle', async () => {
  await mount();
  await Renderer.act(async () => {
    useAuthStore.getState().clear();
  });
  expect(useEditListingDraft.getState().values.title).toBe('');
  expect(editContext('123')).toBeUndefined();
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(put).not.toHaveBeenCalled();
});
test('blur/unmount prevents late success navigation and feedback', async () => {
  let resolve!: (value: unknown) => void;
  put.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  useEditListingDraft.getState().update({ ...draft, title: 'Changed' });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = control.submit();
    await Promise.resolve();
    await Promise.resolve();
  });
  await Renderer.act(async () => {
    tree.unmount();
  });
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Updated',
      data: { ...record, title: 'Changed' },
    },
  });
  await Renderer.act(async () => {
    await pending;
  });
  expect(saved).not.toHaveBeenCalled();
  expect(Toast.show).not.toHaveBeenCalled();
});
test('newer edits during PUT are retained and use the authoritative response as next baseline', async () => {
  let resolve!: (value: unknown) => void;
  put.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  await mount();
  useEditListingDraft.getState().update({ ...draft, title: 'Changed' });
  let pending!: Promise<void>;
  await Renderer.act(async () => {
    pending = control.submit();
    await Promise.resolve();
    await Promise.resolve();
  });
  const newer = { ...draft, title: 'Newer edit' };
  useEditListingDraft.getState().update(newer);
  resolve({
    status: 200,
    data: {
      success: true,
      message: 'Updated',
      data: { ...record, title: 'Changed' },
    },
  });
  await Renderer.act(async () => {
    await pending;
  });
  expect(useEditListingDraft.getState().values).toBe(newer);
  expect(saved).not.toHaveBeenCalled();
  expect(editContext('123')?.state).toBe('ready');
  await Renderer.act(async () => {
    await control.submit();
  });
  expect(put).toHaveBeenLastCalledWith(
    '/customer/listings/123',
    { title: 'Newer edit' },
    expect.any(Object),
  );
});
test('late success for a different listing never replaces its active draft or navigates', async () => {
  let resolve!: (value: unknown) => void; put.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await mount(); useEditListingDraft.getState().update({ ...draft, title: 'Changed' }); let pending!: Promise<void>;
  await Renderer.act(async () => { pending = control.submit(); await Promise.resolve(); await Promise.resolve(); });
  const other = { ...draft, title: 'Other listing' }; useEditListingDraft.setState({ listingId: '999', values: other });
  resolve({ status: 200, data: { success: true, message: 'Updated', data: { ...record, title: 'Changed' } } });
  await Renderer.act(async () => { await pending; }); expect(useEditListingDraft.getState().values).toBe(other); expect(saved).not.toHaveBeenCalled(); expect(Toast.show).not.toHaveBeenCalled();
});

test('edit Back reuses Stay/Keep confirmation and restores Post create entry without clearing its draft', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  useListingDraft.getState().update({ ...draft, title: 'Saved create draft' });
  await mount(<PostListingScreen navigation={navigation as never} route={{ key: 'edit', name: 'PostListing', params: { editListingId: '123' } }} />);
  await Renderer.act(async () => { tree.root.findAllByType(TextInput).find(node => node.props.value === record.title)!.props.onChangeText('Edited title'); });
  await Renderer.act(async () => { navigation.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(); });
  expect(alert).toHaveBeenCalledWith('Keep your listing draft?', expect.any(String), expect.any(Array), expect.any(Object));
  expect(navigation.reset).not.toHaveBeenCalled();
  await Renderer.act(async () => { alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Stay')!.onPress!(); });
  expect(navigation.reset).not.toHaveBeenCalled();
  await Renderer.act(async () => { navigation.setOptions.mock.calls.at(-1)![0].headerLeft().props.onPress(); });
  await Renderer.act(async () => { alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Keep Draft')!.onPress!(); });
  expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PostListing' }] });
  expect(parentNavigate).toHaveBeenCalledWith('ListingsStack', { screen: 'ListingDetails', params: { listingId: '123', returnTo: 'MyListings' } });
  expect(useListingDraft.getState().values.title).toBe('Saved create draft');
  expect(editContext('123')?.draft?.title).toBe('Edited title'); expect(put).not.toHaveBeenCalled();
});
