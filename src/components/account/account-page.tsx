"use client";
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Heart, LogOut, MapPin, Package, Plus, ShoppingBag, UserRound } from 'lucide-react';
import { accountRequest, egyptGovernorates, type Account, type Address } from '@/lib/account';

import {useAuthSession} from '@/components/auth/auth-session';
import {CustomerOrders} from './customer-orders';
type Tab = 'details' | 'addresses' | 'orders';
function DetailsForm({ user }: { user: Account }) {
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: (body: { name: string; phone: string }) => accountRequest<{ user: Account }>('/api/account', 'PATCH', body), onSuccess: data => client.setQueryData(['account'], data) });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    mutation.mutate({ name: String(values.get('name') || '').trim(), phone: String(values.get('phone') || '').trim() });
  };
  return <section className="account-panel"><div className="account-panel-heading"><div><h2>My details</h2><p>Keep your name and contact number up to date.</p></div></div>
    <form className="account-form" onSubmit={submit}><fieldset disabled={mutation.isPending}>
      <label>Full name<input name="name" autoComplete="name" defaultValue={user.name} minLength={2} maxLength={100} required/></label>
      <label>Email address<input aria-label="Email address" type="email" value={user.email} readOnly/><small>Your sign-in email {user.emailVerified ? 'is verified.' : 'is awaiting confirmation.'}</small></label>
      <label>Phone number<input aria-label="Phone number" name="phone" type="tel" autoComplete="tel" defaultValue={user.phone} placeholder="01001234567"/><small>Egyptian mobile number, with or without +20.</small></label>
      <button className="account-primary" type="submit">{mutation.isPending ? 'Saving...' : 'Save details'}</button>
    </fieldset>{mutation.isError && <p className="account-error" role="alert">{mutation.error.message}</p>}{mutation.isSuccess && <p className="account-success" role="status"><Check size={16}/>Your details have been saved.</p>}</form>
  </section>;
}
function AddressForm({ user, address, busy, error, onSave, onCancel }: { user: Account; address?: Address; busy: boolean; error?: string; onSave: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(data.entries());
    body.country = 'Egypt'; body.isDefault = data.get('isDefault') === 'on';
    onSave(body);
  };
  return <form className="account-form address-form" onSubmit={submit}><h3>{address ? 'Edit address' : 'Add an address'}</h3><fieldset disabled={busy}>
    <label>Address label<select aria-label="Address label" name="label" defaultValue={address?.label || 'home'}><option value="home">Home</option><option value="work">Work</option><option value="other">Other</option></select></label>
    <label>Recipient name<input name="name" defaultValue={address?.name || user.name} autoComplete="name" required/></label>
    <label>Mobile number<input name="phone" type="tel" defaultValue={address?.phone || user.phone} autoComplete="tel" placeholder="01001234567" required/></label>
    <label>Country<input value="Egypt" readOnly aria-readonly="true" autoComplete="country-name"/></label>
    <label>Governorate<select aria-label="Governorate" name="governorate" defaultValue={address?.governorate || ''} required autoComplete="address-level1"><option value="">Select governorate</option>{egyptGovernorates.map(name => <option key={name}>{name}</option>)}</select></label>
    <label>City / area<input name="city" defaultValue={address?.city} autoComplete="address-level2" required/></label>
    <label className="form-wide">Street address<input name="street" defaultValue={address?.street} autoComplete="address-line1" required/></label>
    <label>District<input name="district" defaultValue={address?.district}/></label>
    <label>Building number<input name="buildingNumber" defaultValue={address?.buildingNumber}/></label>
    <label>Floor<input name="floor" defaultValue={address?.floor}/></label>
    <label>Apartment number<input name="apartmentNumber" defaultValue={address?.apartmentNumber} autoComplete="address-line2"/></label>
    <label className="form-wide">Landmark<input name="landmark" defaultValue={address?.landmark}/></label>
    <label className="form-wide">Delivery instructions<textarea name="deliveryInstructions" defaultValue={address?.deliveryInstructions} maxLength={300} rows={3}/></label>
    <label className="account-checkbox form-wide"><input type="checkbox" name="isDefault" defaultChecked={address?.isDefault}/>Use as my default address</label>
    <div className="account-form-actions form-wide"><button type="submit" className="account-primary">{busy ? 'Saving...' : 'Save address'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </fieldset>{error && <p className="account-error" role="alert">{error}</p>}</form>;
}
function AddressBook({ user }: { user: Account }) {
  const client = useQueryClient();
  const [form, setForm] = useState<{ address?: Address } | null>(null);
  const [deleting, setDeleting] = useState('');
  const [notice, setNotice] = useState('');
  const query = useQuery({ queryKey: ['addresses'], queryFn: () => accountRequest<{ addresses: Address[] }>('/api/account/addresses'), retry: false, enabled: user.role === 'User' });
  const mutation = useMutation({ mutationFn: ({ path, method, body }: { path: string; method: string; body?: Record<string, unknown> }) => accountRequest(path, method, body), onSuccess: async () => { setForm(null); setDeleting(''); setNotice('Your address book has been updated.'); await client.invalidateQueries({ queryKey: ['addresses'] }); } });
  if (user.role !== 'User') return <section className="account-panel"><h2>Addresses</h2><p>Delivery addresses are available for customer accounts.</p></section>;
  const openForm = (address?: Address) => { mutation.reset(); setNotice(''); setForm({ address }); };
  return <section className="account-panel"><div className="account-panel-heading"><div><h2>My addresses</h2><p>Your delivery addresses in Egypt.</p></div>{!form && <button className="account-primary" onClick={() => openForm()}><Plus size={17}/>Add address</button>}</div>
    {notice && <p className="account-success" role="status">{notice}</p>}
    {form ? <AddressForm key={form.address?._id || 'new'} user={user} address={form.address} busy={mutation.isPending} error={mutation.isError ? mutation.error.message : undefined} onCancel={() => setForm(null)} onSave={body => mutation.mutate({ path: '/api/account/addresses' + (form.address ? '/' + form.address._id : ''), method: form.address ? 'PATCH' : 'POST', body })}/> : <>
      {query.isPending ? <p>Loading addresses...</p> : query.isError ? <div role="alert"><p>{query.error.message}</p><button onClick={() => query.refetch()}>Try again</button></div> : !query.data?.addresses.length ? <div className="account-empty"><MapPin size={34}/><h3>No addresses yet</h3><p>Add your first address for deliveries in Egypt.</p></div> : <div className="address-grid">{query.data.addresses.map(address => <article className="address-card" key={address._id}><div className="address-card-heading"><h3>{address.label}</h3>{address.isDefault && <span>Default</span>}</div><strong>{address.name}</strong><p>{address.phone}</p><p>{[address.buildingNumber, address.street, address.district, address.city, address.governorate, address.country].filter(Boolean).join(', ')}</p>{(address.floor || address.apartmentNumber) && <p>{address.floor && 'Floor ' + address.floor}{address.apartmentNumber && ' / Apartment ' + address.apartmentNumber}</p>}{address.landmark && <p>Near {address.landmark}</p>}{address.deliveryInstructions && <small>{address.deliveryInstructions}</small>}
        <div className="address-actions"><button disabled={mutation.isPending} onClick={() => openForm(address)}>Edit</button>{!address.isDefault && <button disabled={mutation.isPending} onClick={() => mutation.mutate({ path: '/api/account/addresses/' + address._id, method: 'PATCH', body: { isDefault: true } })}>Make default</button>}<button disabled={mutation.isPending} onClick={() => setDeleting(address._id)}>Delete</button></div>
        {deleting === address._id && <div className="address-delete-confirm"><p>Delete this address?</p><button disabled={mutation.isPending} onClick={() => mutation.mutate({ path: '/api/account/addresses/' + address._id, method: 'DELETE' })}>Confirm delete</button><button onClick={() => setDeleting('')}>Keep address</button></div>}
      </article>)}</div>}
      {mutation.isError && <p className="account-error" role="alert">{mutation.error.message}</p>}
    </>}
  </section>;
}
export function AccountPage() {
  const router = useRouter();
  const {signOut}=useAuthSession();
  const [tab, setTab] = useState<Tab>('details');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const account = useQuery({ queryKey: ['account'], queryFn: () => accountRequest<{ user: Account }>('/api/account'), retry: false });
  const logout = async () => {
    setLoggingOut(true); setLogoutError('');
    try { await signOut(); router.replace('/login'); router.refresh(); }
    catch { setLogoutError('Unable to sign out. Please try again.'); setLoggingOut(false); }
  };
  return <div className="account-shell"><header className="account-header"><Link href="/" className="account-logo"><img src="/dorytos-logo.svg" alt="Dorytos"/></Link><Link href="/"><ArrowLeft size={16}/>Continue shopping</Link>{account.data?.user.role==='User'&&<nav aria-label="Shopping links"><Link href="/wishlist"><Heart size={19}/>Wishlist</Link><Link href="/cart"><ShoppingBag size={19}/>Cart</Link></nav>}</header>
    {account.isPending ? <main className="account-loading">Loading your account...</main> : account.isError ? <main className="account-guest">{(account.error as Error & { status?: number }).status === 401 ? <><UserRound size={36}/><h1>Sign in to manage your account</h1><p>Your personal details and delivery addresses are saved to your account.</p><Link className="account-primary" href="/login?next=%2Faccount">Log in to continue</Link></> : <><h1>Account unavailable</h1><p role="alert">{account.error.message}</p><button onClick={() => account.refetch()}>Try again</button></>}</main> : <main className="account-layout"><aside className="account-sidebar"><div className="account-welcome"><span className="account-avatar"><UserRound size={28}/></span><h1>Hi, {account.data.user.name || 'there'}!</h1><p>{account.data.user.email}</p></div><nav aria-label="Account sections">
      {['Seller','Admin'].includes(account.data.user.role) && <Link className="account-primary" href="/seller"><Package size={19}/>Seller center</Link>}
      <button aria-current={tab === 'details' ? 'page' : undefined} onClick={() => setTab('details')}><UserRound size={19}/>My details</button>
      {account.data.user.role==='User'&&<><button aria-current={tab === 'addresses' ? 'page' : undefined} onClick={() => setTab('addresses')}><MapPin size={19}/>Addresses</button>
      <button aria-current={tab === 'orders' ? 'page' : undefined} onClick={() => setTab('orders')}><Package size={19}/>My orders</button></>}
      <button disabled={loggingOut} onClick={() => void logout()}><LogOut size={18}/>{loggingOut ? 'Signing out...' : 'Sign out'}</button>
    </nav>{logoutError && <p role="alert" className="account-error">{logoutError}</p>}</aside><div className="account-content">
      {tab === 'details' && <DetailsForm user={account.data.user}/>}
      {tab === 'addresses' && account.data.user.role==='User' && <AddressBook user={account.data.user}/>}
      {tab === 'orders' && account.data.user.role==='User' && <CustomerOrders/>}
    </div></main>}
  </div>;
}
