# Ticket 3.4: Modal Component Consolidation
**Priority:** MEDIUM | **Effort:** 3 days | **Risk:** LOW

## Description
Consolidate 20+ modal components that share 80% identical structure, reducing code duplication by creating a base modal composition system.

## Current Problem
Every modal repeats this pattern:
- Same Zustand store integration (isOpen, type, onClose, data)
- Identical form handling with react-hook-form + Zod
- Same dialog structure and styling
- Repeated loading states and error handling
- Similar submit/close patterns

## Implementation

### Base Modal Component
```tsx
// src/components/modals/base-modal.tsx
interface BaseModalProps<T = any> {
  type: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: (data: T) => Promise<void> | void;
  onClose?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}

export function BaseModal<T>({
  type,
  title,
  description,
  children,
  onSubmit,
  onClose,
  className,
  size = 'md',
  loading = false,
}: BaseModalProps<T>) {
  const router = useRouter();
  const modalType = useStore(state => state.type);
  const isOpen = useStore(state => state.isOpen);
  const closeModal = useStore(state => state.onClose);

  const isModalOpen = isOpen && modalType === type;

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    closeModal();
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        'bg-white text-black p-0 overflow-hidden',
        sizeClasses[size],
        className
      )}>
        <DialogHeader className='pt-8 px-6'>
          <DialogTitle className='text-2xl text-center font-bold'>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className='text-center text-zinc-500'>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {children}
        </div>
        
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### Form Modal Component
```tsx
// src/components/modals/form-modal.tsx
interface FormModalProps<T extends FieldValues> {
  type: string;
  title: string;
  description?: string;
  schema: ZodSchema<T>;
  defaultValues: T;
  onSubmit: (data: T) => Promise<void>;
  onSuccess?: () => void;
  children: (form: UseFormReturn<T>) => React.ReactNode;
  submitText?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function FormModal<T extends FieldValues>({
  type,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
  children,
  submitText = 'Save',
  size = 'md',
}: FormModalProps<T>) {
  const router = useRouter();
  const closeModal = useStore(state => state.onClose);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const isLoading = form.formState.isSubmitting;

  const handleSubmit = async (data: T) => {
    try {
      await onSubmit(data);
      form.reset();
      router.refresh();
      closeModal();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Something went wrong');
    }
  };

  const handleClose = () => {
    form.reset();
    closeModal();
  };

  return (
    <BaseModal
      type={type}
      title={title}
      description={description}
      size={size}
      loading={isLoading}
      onClose={handleClose}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {children(form)}
          
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                submitText
              )}
            </Button>
          </div>
        </form>
      </Form>
    </BaseModal>
  );
}
```

### Confirmation Modal Component
```tsx
// src/components/modals/confirmation-modal.tsx
interface ConfirmationModalProps {
  type: string;
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function ConfirmationModal({
  type,
  title,
  description,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const closeModal = useStore(state => state.onClose);
  const router = useRouter();

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      router.refresh();
      closeModal();
    } catch (error) {
      console.error('Confirmation error:', error);
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmButtonClass = variant === 'destructive'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-bold';

  return (
    <BaseModal
      type={type}
      title={title}
      description={description}
      size="sm"
      loading={isLoading}
    >
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={closeModal}
          disabled={isLoading}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          className={confirmButtonClass}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            confirmText
          )}
        </Button>
      </div>
    </BaseModal>
  );
}
```

### Modal Usage Examples
```tsx
// src/components/modals/create-channel-modal.tsx
export function CreateChannelModal() {
  return (
    <FormModal
      type="createChannel"
      title="Create Channel"
      description="Create a new channel for your server"
      schema={createChannelSchema}
      defaultValues={{ name: '', type: 'TEXT', sectionId: '' }}
      onSubmit={handleCreateChannel}
      submitText="Create Channel"
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel Name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Enter channel name"
                    className="border-0 focus-visible:ring-0 text-black focus-visible:ring-offset-0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="AUDIO">Audio</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </FormModal>
  );
}

// src/components/modals/delete-channel-modal.tsx
export function DeleteChannelModal() {
  const data = useStore(state => state.data);
  
  return (
    <ConfirmationModal
      type="deleteChannel"
      title="Delete Channel"
      description={`Are you sure you want to delete #${data?.channel?.name}? This action cannot be undone.`}
      onConfirm={() => handleDeleteChannel(data?.channel?.id)}
      confirmText="Delete Channel"
      variant="destructive"
    />
  );
}
```

## Migration Strategy
1. **Create base components** (BaseModal, FormModal, ConfirmationModal)
2. **Migrate simple modals first** (delete confirmations)
3. **Migrate form modals** in batches of 3-5
4. **Update complex modals** (cancellation flow)
5. **Remove old modal code** after testing

## Acceptance Criteria
- [ ] Create BaseModal component with common dialog structure
- [ ] Implement FormModal with integrated react-hook-form + Zod
- [ ] Create ConfirmationModal for delete/confirm actions
- [ ] Migrate 10 existing modals to use new base components
- [ ] Reduce modal-related code by 60%+
- [ ] Maintain exact same user experience and functionality
- [ ] Add comprehensive TypeScript typing for all modal props

## Files to Create/Modify
- `src/components/modals/base-modal.tsx` (new)
- `src/components/modals/form-modal.tsx` (new)
- `src/components/modals/confirmation-modal.tsx` (new)
- Migrate these modals first:
  - `src/components/modals/create-channel-modal.tsx`
  - `src/components/modals/edit-channel-modal.tsx`
  - `src/components/modals/delete-channel-modal.tsx`
  - `src/components/modals/create-section-modal.tsx`
  - `src/components/modals/edit-section-modal.tsx`
  - `src/components/modals/delete-section-modal.tsx`

### Documentation Requirements
- [ ] Create modal component architecture diagram showing inheritance hierarchy
- [ ] Document modal patterns and usage guidelines in `docs/developers/ui-components.md`
- [ ] Add accessibility guidelines for modal implementations

### Testing Requirements
- [ ] **Unit Tests**: Modal component functionality and prop handling
- [ ] **Integration Tests**: Modal interactions with form validation and data flow
- [ ] **UI Tests**: Modal responsiveness, accessibility, and user interactions
- [ ] **Accessibility Tests**: Keyboard navigation, screen reader compatibility, focus management
- [ ] **Cross-browser Tests**: Modal functionality across different browsers

## Dependencies
None - can be implemented independently 