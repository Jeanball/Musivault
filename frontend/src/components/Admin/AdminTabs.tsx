import React from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

const AdminTabs: React.FC = () => {
    const location = useLocation();
    const { t } = useTranslation();

    const tabs = [
        {
            to: '/app/admin',
            label: t('admin.sections.users', 'Users'),
            isActive: location.pathname === '/app/admin',
        },
        {
            to: '/app/admin/tasks',
            label: t('admin.sections.tasks', 'Tasks'),
            isActive: location.pathname === '/app/admin/tasks',
        },
    ];

    return (
        <div className="tabs tabs-boxed bg-base-200 inline-flex">
            {tabs.map((tab) => (
                <Link
                    key={tab.to}
                    to={tab.to}
                    className={`tab px-4 ${tab.isActive ? 'tab-active' : ''}`}
                >
                    {tab.label}
                </Link>
            ))}
        </div>
    );
};

export default AdminTabs;
