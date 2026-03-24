import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from '../components/Layout';

export function ForbiddenPage() {
  useEffect(() => {
    document.title = '403 无权限访问 - 元体WIKI';
  }, []);

  return (
    <Layout>
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">403 无权限访问</div>
            <div className="card-sub">当前账号没有访问该页面的权限。</div>
          </div>
        </div>
        <p className="card-sub">
          若你需要管理权限，请联系系统管理员分配相应权限。
        </p>
        <div style={{ marginTop: 12 }}>
          <Link className="btn btn-secondary" to="/">
            返回首页
          </Link>
        </div>
      </section>
    </Layout>
  );
}

