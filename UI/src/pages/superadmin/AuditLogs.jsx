import { useState, useEffect } from 'react';
import { ShieldAlert, Search, Filter } from 'lucide-react';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { Avatar } from '../../components/ui/Avatar';
import api from '../../services/api';
import { formatDateTime } from '../../utils/cn';
import toast from 'react-hot-toast';

const actionColors = {
  LOGIN: 'info', CREATE_SECTOR: 'success', CREATE_USER: 'success',
  UPDATE_SECTOR: 'warning', DELETE_SECTOR: 'danger',
  SCHEDULE_INTERVIEW: 'brand', VALIDATE_INTERVIEW: 'success',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  useEffect(() => { load(); }, [page, actionType]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT, ...(actionType && { actionType }), ...(search && { search }) });
      const res = await api.get(`/analytics/audit-logs?${params}`);
      setLogs(res.data.data.logs);
      setTotal(res.data.pagination?.total || 0);
    } catch { toast.error('Failed to load audit logs'); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {total.toLocaleString()} total events
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search action or entity..."
            value={search}
            onChange={e => { setSearch(e.target.value); }}
            style={{ maxWidth: 280 }}
            leftIcon={<Search size={15} />}
          />
          <Select value={actionType} onChange={e => setActionType(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All Actions</option>
            {['LOGIN', 'CREATE_USER', 'DELETE_USER', 'CREATE_SECTOR', 'DELETE_SECTOR', 'SCHEDULE_INTERVIEW', 'VALIDATE_INTERVIEW', 'ASSIGN_CANDIDATES'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          <button className="btn btn-secondary" onClick={load}><Filter size={15} /> Apply</button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><SkeletonTable rows={10} cols={7} /></td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    <ShieldAlert size={32} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
                    No audit logs found
                  </td>
                </tr>
              ) : logs.map((log, i) => (
                <tr key={log.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={log.user?.name || 'System'} size="sm" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{log.user?.name || 'System'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {log.role && <Badge variant="brand">{log.role}</Badge>}
                  </td>
                  <td>
                    <Badge variant={actionColors[log.actionType] || 'neutral'}>{log.actionType}</Badge>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{log.entity || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>{log.ipAddress || '—'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {log.deviceInfo ? log.deviceInfo.slice(0, 40) + '...' : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              Page {page} of {Math.ceil(total / LIMIT)}
            </span>
            <button className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
