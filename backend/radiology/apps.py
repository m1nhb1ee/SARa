from django.apps import AppConfig


class RadiologyConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'radiology'
    verbose_name = 'Smart Radiology Training'
    
    def ready(self):
        import radiology.signals
