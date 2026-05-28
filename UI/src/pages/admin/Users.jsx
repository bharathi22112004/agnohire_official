import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Shield, Award, Mail, Trash2, Tag, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'hr' });
  const [creating, setCreating] = useState(false);

  // Recruiter Skills State (For Editing Existing Recruiter)
  const [selectedDomain, setSelectedDomain] = useState('');
  const [skillTags, setSkillTags] = useState('');
  const [assignedSkills, setAssignedSkills] = useState([]);
  const [savingSkills, setSavingSkills] = useState(false);

  // Recruiter Skills State (For Creating New Recruiter)
  const [createSkills, setCreateSkills] = useState([]);
  const [createSelectedDomain, setCreateSelectedDomain] = useState('');
  const [createSkillTags, setCreateSkillTags] = useState('');

  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [usersRes, domainsRes] = await Promise.all([
        api.get('/users?limit=100'),
        api.get(`/sectors/${currentUser.sectorId}/domains`)
      ]);
      setUsers(usersRes.data.data.users);
      setDomains(domainsRes.data.data.domains || []);
    } catch {
      toast.error('Failed to load sector users');
    } finally {
      setLoading(false);
    }
  }

  // Extract Role ID from loaded users to construct map
  const roleMap = {};
  users.forEach(u => {
    if (u.role) {
      roleMap[u.role.name] = u.role.id;
    }
  });
  // Fallback role mapping in case empty
  if (!roleMap.hr) roleMap.hr = currentUser.roleId;

  function handleAddCreateSkill(e) {
    e.preventDefault();
    if (!createSelectedDomain) return toast.error('Select a domain first');
    const tags = createSkillTags.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return toast.error('Add at least one skill tag');

    const newSkill = {
      domainId: createSelectedDomain,
      domain: domains.find(d => d.id === createSelectedDomain),
      skillTags: tags
    };

    setCreateSkills([...createSkills, newSkill]);
    setCreateSelectedDomain('');
    setCreateSkillTags('');
  }

  function handleRemoveCreateSkill(idx) {
    setCreateSkills(createSkills.filter((_, i) => i !== idx));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const selectedRoleId = roleMap[form.role] || currentUser.roleId;
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password || 'User@123456',
        roleId: selectedRoleId,
        sectorId: currentUser.sectorId
      };

      if (form.role === 'recruiter') {
        payload.skills = createSkills.map(s => ({
          domainId: s.domainId,
          skillTags: s.skillTags
        }));
      }

      await api.post('/users', payload);
      toast.success(`${form.role.toUpperCase()} user created successfully`);
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'hr' });
      setCreateSkills([]);
      setCreateSelectedDomain('');
      setCreateSkillTags('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  function handleDeleteUser(user) {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmDelete() {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${userToDelete.id}`);
      toast.success(`${userToDelete.role?.name.toUpperCase()} user deactivated successfully`);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to deactivate user');
    } finally {
      setDeleting(false);
    }
  }

  async function handleOpenSkills(recruiter) {
    setSelectedRecruiter(recruiter);
    setShowSkills(true);
    setAssignedSkills([]);
    setSelectedDomain('');
    setSkillTags('');
    try {
      const res = await api.get(`/users/${recruiter.id}/skills`);
      setAssignedSkills(res.data.data.skills || []);
    } catch {
      toast.error('Failed to load recruiter skills');
    }
  }

  async function handleAddSkill(e) {
    e.preventDefault();
    if (!selectedDomain) return toast.error('Select a domain first');
    const tags = skillTags.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return toast.error('Add at least one skill tag');

    const newSkill = {
      domainId: selectedDomain,
      domain: domains.find(d => d.id === selectedDomain),
      skillTags: tags
    };

    setAssignedSkills([...assignedSkills, newSkill]);
    setSelectedDomain('');
    setSkillTags('');
  }

  async function handleRemoveAssignedSkill(idx) {
    setAssignedSkills(assignedSkills.filter((_, i) => i !== idx));
  }

  async function handleSaveSkills() {
    setSavingSkills(true);
    try {
      const payload = assignedSkills.map(s => ({
        domainId: s.domainId,
        skillTags: s.skillTags
      }));
      await api.put(`/users/${selectedRecruiter.id}/skills`, { skills: payload });
      toast.success('Recruiter skills successfully assigned');
      setShowSkills(false);
      loadData();
    } catch {
      toast.error('Failed to save recruiter skills');
    } finally {
      setSavingSkills(false);
    }
  }

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter ? u.role?.name === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sector Members</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Manage recruiting officials, HR managers, and coordinators within your sector
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Add Member
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input
          placeholder="Search members by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300, marginBottom: 0 }}
        />
        <Select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ width: 180, marginBottom: 0 }}
        >
          <option value="">All Roles</option>
          <option value="admin">Admins</option>
          <option value="hr">HR Managers</option>
          <option value="recruiter">Recruiters</option>
        </Select>
      </div>

      {/* Grid of Members */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 160 }} />)
        ) : filtered.length === 0 ? (
          <div className="card" style={{ gridColumn: '1 / -1', padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            No members found in this sector
          </div>
        ) : (
          filtered.map((u, i) => (
            <motion.div
              key={u.id}
              className="card"
              style={{
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 180,
                cursor: u.role?.name === 'recruiter' ? 'pointer' : 'default'
              }}
              whileHover={u.role?.name === 'recruiter' ? { scale: 1.015, y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' } : {}}
              onClick={() => {
                if (u.role?.name === 'recruiter') {
                  navigate(`/admin/recruiters/${u.id}`);
                }
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{u.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge variant={u.role?.name === 'admin' ? 'brand' : u.role?.name === 'hr' ? 'success' : 'info'}>
                      {u.role?.name.toUpperCase()}
                    </Badge>
                    {u.id !== currentUser.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteUser(u);
                        }}
                        style={{
                          color: 'var(--color-danger)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete Recruiter"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                  {u.email}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: 12, marginTop: 16 }}>
                {u.role?.name === 'recruiter' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Tag size={13} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSkills(u);
                    }}
                  >
                    Skills & Domains
                  </Button>
                ) : (
                  <div />
                )}
                <Badge variant={u.isActive ? 'success' : 'neutral'}>
                  {u.isActive ? 'Active' : 'Deactivated'}
                </Badge>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Member Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreateSkills([]);
          setCreateSelectedDomain('');
          setCreateSkillTags('');
        }}
        title="Add Sector Member"
        size={form.role === 'recruiter' ? 'lg' : 'md'}
        footer={
          <>
            <Button variant="ghost" onClick={() => {
              setShowCreate(false);
              setCreateSkills([]);
              setCreateSelectedDomain('');
              setCreateSkillTags('');
            }}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create User</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Full Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email Address" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          <Input label="Temporary Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Default: User@123456" />
          <Select label="Platform Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="hr">HR Manager</option>
            <option value="recruiter">Recruiter</option>
            <option value="admin">Sector Admin</option>
          </Select>

          {form.role === 'recruiter' && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                <BookOpen size={14} style={{ color: 'var(--color-brand)' }} /> Map Recruiter Skills & Domains
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
                <Select
                  label="Domain"
                  value={createSelectedDomain}
                  onChange={e => setCreateSelectedDomain(e.target.value)}
                  style={{ marginBottom: 0 }}
                >
                  <option value="">Select Domain...</option>
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Skill Tags"
                      placeholder="React, CSS"
                      value={createSkillTags}
                      onChange={e => setCreateSkillTags(e.target.value)}
                      style={{ marginBottom: 0 }}
                      helper="Comma-separated"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddCreateSkill}
                    style={{ height: 40, whiteSpace: 'nowrap' }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* List of currently added skills for creation */}
              {createSkills.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {createSkills.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        fontSize: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.domain?.name}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {s.skillTags?.map(tag => (
                            <Badge key={tag} variant="neutral" style={{ fontSize: 10 }}>{tag}</Badge>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCreateSkill(idx)}
                        style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Recruiter Skills Modal */}
      <Modal
        isOpen={showSkills}
        onClose={() => setShowSkills(false)}
        title={`Skills & Domains — ${selectedRecruiter?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSkills(false)}>Cancel</Button>
            <Button onClick={handleSaveSkills} loading={savingSkills}>Save Skill Profile</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Add Skill Mapping */}
          <form onSubmit={handleAddSkill} className="card" style={{ padding: 16, background: 'var(--bg-card-header)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={15} style={{ color: 'var(--color-brand)' }} /> Add Domain Mapping
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Domain"
                value={selectedDomain}
                onChange={e => setSelectedDomain(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="">Select Domain...</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>

              <Input
                label="Skill Tags"
                placeholder="React, Redux, Typescript"
                value={skillTags}
                onChange={e => setSkillTags(e.target.value)}
                style={{ marginBottom: 0 }}
                helper="Comma-separated skills list"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" size="sm" variant="secondary">Add Skill Map</Button>
            </div>
          </form>

          {/* Assigned Skills List */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Currently Mapped Competencies</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {assignedSkills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, border: '1px dashed var(--border-color)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                  No domains currently mapped to this recruiter
                </div>
              ) : (
                assignedSkills.map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      background: 'var(--bg-surface)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.domain?.name || 'Assigned Domain'}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {s.skillTags?.map(tag => (
                          <Badge key={tag} variant="neutral">{tag}</Badge>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveAssignedSkill(idx)}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={`Deactivate User`}
        message={`Are you sure you want to deactivate ${userToDelete?.name}? They will no longer be able to log in or manage workloads.`}
        confirmLabel="Deactivate"
        loading={deleting}
      />
    </div>
  );
}
