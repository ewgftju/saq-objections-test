import { Button, Notice, PageHeading } from "../../../components/ui";
import type {
  CaseNotification,
  Role,
} from "../../../types";
import { formatDate } from "../../../utils/dateFormat";

export default function NotificationsPage({
  notifications,
  onOpenCase,
  role,
  activeCommissionMemberId,
  onAnswerAttendancePoll,
}: {
  notifications: CaseNotification[];
  onOpenCase: (caseId: string) => void;
  role: Role;
  activeCommissionMemberId: string;
  onAnswerAttendancePoll: (notificationId: string) => void;
}) {
  const visibleNotifications =
    role === "commission"
      ? notifications.filter(
          (notification) =>
            notification.kind === "attendance-poll" &&
            notification.commissionMemberId === activeCommissionMemberId,
        )
      : notifications.filter((notification) => notification.kind !== "attendance-poll");
  return (
    <>
      <PageHeading
        title="Уведомления"
        subtitle={
          role === "commission"
            ? "Опросы о присутствии и доступ к материалам заседаний"
            : "Автоматические сообщения объектам аудита и заявителям"
        }
      />
      {visibleNotifications.length === 0 ? (
        <Notice>Уведомлений пока нет.</Notice>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Получатель</th>
                  <th>Текст уведомления</th>
                  <th>Обращение</th>
                </tr>
              </thead>
              <tbody>
                {visibleNotifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>{formatDate(notification.date)}</td>
                    <td>{notification.recipient}</td>
                    <td>
                      {notification.text}
                      {notification.kind === "attendance-poll" && !notification.read && (
                        <span className="badge blue notification-new-badge">Новое</span>
                      )}
                    </td>
                    <td>
                      {notification.kind === "attendance-poll" ? (
                        <Button
                          primary
                          onClick={() =>
                            notification.attendancePollId &&
                            notification.commissionMemberId &&
                            onAnswerAttendancePoll(notification.id)
                          }
                        >
                          Ответить
                        </Button>
                      ) : (
                        <Button onClick={() => onOpenCase(notification.caseId)}>
                          Открыть
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
