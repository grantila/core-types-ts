import { WarnFunction } from 'core-types'


export interface ToTsOptions
{
	warn?: WarnFunction;

	/**
	 * The name of the file the result will be written to
	 */
	filename?: string;

	/**
	 * The name of the source file used to convert to TypeScript
	 */
	sourceFilename?: string;

	/**
	 * Use `unknown` instead of `any` for any-types.
	 */
	useUnknown?: boolean;

	/**
	 * Write a declaration file, where e.g. "export interface" becomes
	 * "export declare interface".
	 */
	declaration?: boolean;

	/**
	 * The name of the package using this package to perform the conversion
	 */
	userPackage?: string;

	/**
	 * The url to the package using this package
	 */
	userPackageUrl?: string;

	/**
	 * Set to true to prevent writing the "disable linting" comment
	 */
	noDisableLintHeader?: boolean;

	/**
	 * Set to true to not write a top-level descriptive comment about the
	 * auto-generated file
	 */
	noDescriptiveHeader?: boolean;

	/**
	 * What to do when detecting an unsupported type
	 *
	 *  - `ignore`: Ignore (skip) type
	 *  - `warn`: Ignore type, but warn (default)
	 *  - `error`: Throw an error
	 */
	unsupported?: 'ignore' | 'warn' | 'error';
}

export interface FromTsOptions
{
	warn?: WarnFunction;

	/**
	 * What to do when detecting a non-exported type:
	 *
	 *  - `fail`: Fail conversion with an Error
	 *  - `ignore`: Don't include non-exported types, but allow references to
	 *    them
	 *  - `include`: Include non-exported types
	 *  - `inline`: Don't include non-exported types, inline them if necessary.
	 *    Will throw an Error if the inlined types have cyclic dependencies.
	 *  - `include-if-referenced`: Include non-exported types only if they are
	 *    referenced from exported types (default)
	 */
	nonExported?:
		| 'fail'
		| 'ignore'
		| 'include'
		| 'inline'
		| 'include-if-referenced';

	/**
	 * What to do when detecting an unsupported type
	 *
	 *  - `ignore`: Ignore (skip) type (default)
	 *  - `warn`: Ignore type, but warn
	 *  - `error`: Throw an error
	 */
	unsupported?: 'ignore' | 'warn' | 'error';
}
