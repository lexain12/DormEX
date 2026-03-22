import os
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from ..core.exceptions import ExternalServiceError


logger = logging.getLogger(__name__)


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class EmailService:
    def __init__(self) -> None:
        self.smtp_host = os.getenv("SMTP_HOST", "mailhog")
        self.smtp_port = int(os.getenv("SMTP_PORT", "1025"))
        self.smtp_username = (os.getenv("SMTP_USERNAME") or "").strip() or None
        self.smtp_password = (os.getenv("SMTP_PASSWORD") or "").strip() or None
        self.smtp_timeout_sec = int(os.getenv("SMTP_TIMEOUT_SEC", "10"))
        self.smtp_use_tls = _parse_bool(os.getenv("SMTP_USE_TLS"), default=False)
        self.smtp_use_ssl = _parse_bool(os.getenv("SMTP_USE_SSL"), default=False)
        self.from_email = os.getenv("SMTP_FROM_EMAIL", "no-reply@campus.test")
        self.from_name = os.getenv("SMTP_FROM_NAME", "dormex")
        self.local_auth_email_domain = os.getenv("LOCAL_AUTH_EMAIL_DOMAIN", "campus.test").lower()

    def send_verification_code(
        self,
        *,
        recipient_email: str,
        verification_code: str,
        expires_in_sec: int,
    ) -> None:
        message = EmailMessage()
        message["Subject"] = "Код входа в dormex"
        message["From"] = formataddr((self.from_name, self.from_email))
        message["To"] = recipient_email

        expires_minutes = max(1, expires_in_sec // 60)
        plain_text = (
            "Здравствуйте!\n\n"
            f"Ваш код для входа в dormex: {verification_code}\n"
            f"Код действует около {expires_minutes} мин.\n\n"
            "Если вы не запрашивали вход, просто проигнорируйте это письмо."
        )
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <p>Здравствуйте!</p>
            <p>Ваш код для входа в <strong>dormex</strong>:</p>
            <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">{verification_code}</p>
            <p>Код действует около {expires_minutes} мин.</p>
            <p style="color: #6b7280;">Если вы не запрашивали вход, просто проигнорируйте это письмо.</p>
          </body>
        </html>
        """

        message.set_content(plain_text)
        message.add_alternative(html, subtype="html")

        try:
            smtp_class = smtplib.SMTP_SSL if self.smtp_use_ssl else smtplib.SMTP
            with smtp_class(self.smtp_host, self.smtp_port, timeout=self.smtp_timeout_sec) as smtp:
                if not self.smtp_use_ssl:
                    smtp.ehlo()
                    if self.smtp_use_tls:
                        smtp.starttls()
                        smtp.ehlo()

                if self.smtp_username and self.smtp_password:
                    smtp.login(self.smtp_username, self.smtp_password)

                smtp.send_message(message)
        except smtplib.SMTPAuthenticationError as error:
            raise ExternalServiceError(
                "SMTP отклонил авторизацию. Проверьте логин почты и пароль приложения."
            ) from error
        except smtplib.SMTPRecipientsRefused as error:
            raise ExternalServiceError(
                "Почтовый провайдер отклонил адрес получателя. Для реальной отправки используйте существующий email, а не demo-адрес."
            ) from error
        except smtplib.SMTPResponseException as error:
            if error.smtp_code in {451, 452}:
                raise ExternalServiceError(
                    "Почтовый провайдер временно ограничил отправку. Подождите немного и попробуйте снова."
                ) from error
            if error.smtp_code in {550, 551, 552, 553, 554}:
                raise ExternalServiceError(
                    "Почтовый провайдер отклонил письмо. Проверьте, что email получателя существует и принимает письма."
                ) from error
            raise ExternalServiceError(
                f"SMTP вернул ошибку {error.smtp_code}. Проверьте настройки почты и адрес получателя."
            ) from error
        except (OSError, smtplib.SMTPException) as error:
            logger.exception(
                "SMTP send failed host=%s port=%s ssl=%s tls=%s from=%s to=%s",
                self.smtp_host,
                self.smtp_port,
                self.smtp_use_ssl,
                self.smtp_use_tls,
                self.from_email,
                recipient_email,
            )
            raise ExternalServiceError(
                "Не удалось отправить письмо с кодом. Проверьте SMTP-настройки и повторите попытку."
            ) from error
