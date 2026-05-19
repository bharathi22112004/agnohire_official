import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Building2, Users, MoreHorizontal, Edit2, Trash2, ToggleLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatDate } from '../../utils/cn';

const SECTOR_TYPES = ['IT', 'Civil', 'MBBS', 'Mechanical', 'AI/ML', 'Finance', 'Marketing', 'HR', 'Legal', 'Operations'];

export default function Sectors() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'IT',
    adminName: '', adminEmail: '', adminPassword: '',
    hrName: '', hrEmail: '', hrPassword: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await api.get('/sectors?limit=100');
      setSectors(res.data.data.sectors);
    } catch { toast.error('Failed to load sectors'); }
    finally { setLoading(false); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/sectors', form);
      toast.success('Sector created with default Admin and HR');
      setShowCreate(false);
      setForm({ name: '', type: 'IT', adminName: '', adminEmail: '', adminPassword: '', hrName: '', hrEmail: '', hrPassword: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create sector');
    } finally { setCreating(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/sectors/${deleteId}`);
      toast.success('Sector deleted');
      setSectors(sectors.filter(s => s.id !== deleteId));
      setDeleteId(null);
    } catch { toast.error('Failed to delete sector'); }
    finally { setDeleting(false); }
  }

  async function toggleStatus(sector) {
    const newStatus = sector.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/sectors/${sector.id}`, { status: newStatus });
      setSectors(sectors.map(s => s.id === sector.id ? { ...s, status: newStatus } : s));
      toast.success(`Sector ${newStatus}`);
    } catch { toast.error('Failed to update status'); }
  }

  const filtered = sectors.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sectors</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {sectors.length} sector{sectors.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          New Sector
        </Button>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12 }}>
        <Input
          placeholder="Search sectors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Sector</th>
                <th>Type</th>
                <th>Users</th>
                <th>Candidates</th>
                <th>Domains</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8}><SkeletonTable rows={5} cols={8} /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    <Building2 size={32} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
                    No sectors found
                  </td>
                </tr>
              ) : (
                filtered.map((sector, i) => (
                  <motion.tr
                    key={sector.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>{sector.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sector.id.slice(0, 8)}...</div>
                    </td>
                    <td><Badge variant="brand">{sector.type}</Badge></td>
                    <td>{sector._count?.users ?? '—'}</td>
                    <td>{sector._count?.candidates ?? '—'}</td>
                    <td>{sector._count?.domains ?? '—'}</td>
                    <td><StatusBadge status={sector.status} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{formatDate(sector.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => toggleStatus(sector)}
                          className="btn btn-ghost btn-icon btn-sm"
                          title="Toggle status"
                        >
                          <ToggleLeft size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(sector.id)}
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--color-danger)' }}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Sector"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create Sector</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="Sector Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Information Technology" required />
            <Select label="Sector Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {SECTOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>

          <div className="divider" />
          <p className="section-title" style={{ margin: 0 }}>Default Admin</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Name" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} required />
            <Input label="Email" type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} required />
            <Input label="Password" type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Admin@123" />
          </div>

          <div className="divider" />
          <p className="section-title" style={{ margin: 0 }}>Default HR</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Name" value={form.hrName} onChange={e => setForm({ ...form, hrName: e.target.value })} required />
            <Input label="Email" type="email" value={form.hrEmail} onChange={e => setForm({ ...form, hrEmail: e.target.value })} required />
            <Input label="Password" type="password" value={form.hrPassword} onChange={e => setForm({ ...form, hrPassword: e.target.value })} placeholder="Hr@123456" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Sector"
        message="This will deactivate the sector and all associated data. Are you sure?"
      />
    </div>
  );
}
